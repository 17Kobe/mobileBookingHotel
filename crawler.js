const puppeteer = require('puppeteer');
const chromePaths = require('chrome-paths');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class HotelBookingCrawler {
    constructor() {
        this.browser = null;
        this.page = null;
        this.config = null;
        this.configPath = path.join(__dirname, 'config.json');
        // GitHub Gist 設定 - 請在環境變數或這裡設定您的 Gist raw URL
        this.gistUrl = process.env.GIST_URL || 'https://gist.githubusercontent.com/17Kobe/fae5d61a5c205688abe8ca9a72a1f733/raw/booking.json';
        this.lastSmsCode = '';
        this.smsMonitorInterval = null;
    }

    // 從 GitHub Gist 讀取設定檔
    async loadConfigFromGist() {
        try {
            console.log('從 GitHub Gist 讀取設定檔...');
            const response = await axios.get(this.gistUrl);
            this.config = response.data;
            this.lastSmsCode = this.config.sms_code || '';
            console.log('✅ 設定檔從 Gist 載入成功');
            console.log('設定內容:', {
                user_name: this.config.user_name,
                book_hotel_name: this.config.book_hotel_name,
                room_no: this.config.room_no,
                sms_code: this.config.sms_code ? '***已設定***' : '未設定'
            });
        } catch (error) {
            console.error('❌ 無法從 Gist 讀取設定檔:', error.message);
            console.log('嘗試讀取本地設定檔...');
            this.loadConfig();
        }
    }

    // 讀取本地設定檔（備用方案）
    loadConfig() {
        try {
            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.lastSmsCode = this.config.sms_code || '';
            console.log('本地設定檔載入成功');
        } catch (error) {
            console.error('無法讀取本地設定檔:', error);
            throw error;
        }
    }

    // 每5秒監控 GitHub Gist 的簡訊驗證碼變化
    startSmsMonitoring(callback) {
        console.log('🔍 開始每5秒監控 GitHub Gist 的簡訊驗證碼變化...');
        console.log('Gist URL:', this.gistUrl);
        
        this.smsMonitorInterval = setInterval(async () => {
            try {
                const response = await axios.get(this.gistUrl);
                const newConfig = response.data;
                const currentSmsCode = newConfig.sms_code || '';
                
                // 只有當 sms_code 從空值變為有值，或從一個值變為另一個值時才觸發回調
                if (currentSmsCode !== this.lastSmsCode && currentSmsCode.trim() !== '') {
                    console.log('🎯 偵測到 Gist 中的簡訊驗證碼變化!');
                    console.log('舊驗證碼:', this.lastSmsCode || '(空)');
                    console.log('新驗證碼:', currentSmsCode);
                    
                    this.lastSmsCode = currentSmsCode;
                    this.config = newConfig; // 更新完整設定
                    
                    // 停止監控
                    this.stopSmsMonitoring();
                    
                    callback(currentSmsCode);
                } else if (currentSmsCode !== this.lastSmsCode) {
                    console.log('⚠️  Gist 中的 sms_code 已變更但不符合觸發條件');
                    console.log('目前值:', `"${currentSmsCode}"`);
                    this.lastSmsCode = currentSmsCode;
                }
            } catch (error) {
                console.error('❌ 監控 Gist 時發生錯誤:', error.message);
            }
        }, 5000); // 每5秒檢查一次
    }

    // 停止簡訊監控
    stopSmsMonitoring() {
        if (this.smsMonitorInterval) {
            clearInterval(this.smsMonitorInterval);
            this.smsMonitorInterval = null;
            console.log('🛑 已停止簡訊監控');
        }
    }

    async init() {
        await this.loadConfigFromGist();
        
        // 啟動瀏覽器
        this.browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH || chromePaths.chrome,
            ignoreHTTPSErrors: true,
            headless: process.env.NODE_ENV === 'production' ? 'new' : false,
            defaultViewport: null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const allPages = await this.browser.pages();
        this.page = allPages[0];
    }

    async login() {
        const { user_name, user_pass } = this.config;

        if (!user_name || !user_pass) {
            throw new Error('缺少使用者名稱或密碼!');
        }

        await this.page.goto(
            'https://iam.cht.com.tw/auth/realms/B2E/protocol/openid-connect/auth?response_type=code&redirect_uri=https%3A%2F%2Fresort.cht.com.tw%2Fchtiam_new.php&client_id=RESORT-MAIN.OL.IT&scope=ldap'
        );

        await this.page.waitForSelector('#username', { visible: true });
        await this.page.type('#username', user_name, { delay: 100 });
        await this.page.waitForSelector('#password', { visible: true });
        await this.page.type('#password', user_pass, { delay: 100 });
        await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }), 
            this.page.click('#kc-login')
        ]);

        console.log('登入成功，等待 OTP 驗證...');
    }

    async handleOTPVerification() {
        // 等待「按此取得驗證碼」按鈕可用
        await this.page.waitForSelector('#kc-sendotp', { visible: true });
        await this.page.waitForFunction(
            () => {
                const btn = document.querySelector('#kc-sendotp');
                return btn && !btn.disabled;
            },
            { timeout: 15000 }
        );

        // 點擊按鈕取得 OTP
        await this.page.click('#kc-sendotp');
        console.log('已發送 OTP 驗證碼');

        // 等待 OTP 輸入框
        await this.page.waitForSelector('#totp', { visible: true, timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 設定 focus
        await this.setOTPFocus();

        // 等待用戶輸入 OTP（透過監控 GitHub Gist）
        return new Promise((resolve, reject) => {
            console.log('=== 等待簡訊驗證碼 ===');
            console.log('請在 GitHub Gist 中將收到的簡訊驗證碼填入 "sms_code" 欄位');
            console.log('例如: "sms_code": "123456"');
            console.log('系統將每5秒自動檢查 Gist 變化並輸入驗證碼...');
            console.log('Gist URL:', this.gistUrl);
            
            const timeout = setTimeout(() => {
                console.log('❌ OTP 輸入超時（5分鐘）');
                this.stopSmsMonitoring();
                reject(new Error('OTP 輸入超時'));
            }, 300000); // 5分鐘超時

            this.startSmsMonitoring(async (smsCode) => {
                try {
                    clearTimeout(timeout);
                    console.log('✅ 從 Gist 收到簡訊驗證碼:', smsCode);
                    
                    // 清空輸入框並輸入驗證碼
                    await this.page.evaluate(() => {
                        const totpInput = document.querySelector('#totp');
                        if (totpInput) {
                            totpInput.value = '';
                        }
                    });
                    
                    console.log('🔢 正在輸入驗證碼...');
                    await this.page.type('#totp', smsCode.toString(), { delay: 100 });
                    
                    console.log('📤 正在提交驗證碼...');
                    // 提交表單 - 點擊指定的提交按鈕
                    await Promise.all([
                        this.page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
                        this.page.click('#kc-login')
                    ]);
                    
                    console.log('✅ OTP 驗證成功');
                    
                    resolve();
                } catch (error) {
                    console.error('❌ OTP 驗證過程發生錯誤:', error);
                    reject(error);
                }
            });
        });
    }

    async setOTPFocus() {
        let focusSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const totpExists = await this.page.$('#totp');
                if (!totpExists) {
                    throw new Error('OTP 輸入框不存在');
                }

                await this.page.waitForFunction(
                    () => {
                        const totpInput = document.querySelector('#totp');
                        return totpInput && !totpInput.disabled && !totpInput.readOnly;
                    },
                    { timeout: 5000 }
                );

                await new Promise(resolve => setTimeout(resolve, 500));
                await this.page.focus('#totp');
                
                await this.page.evaluate(() => {
                    const totpInput = document.querySelector('#totp');
                    if (totpInput) {
                        totpInput.focus();
                        totpInput.dispatchEvent(new Event('focus', { bubbles: true }));
                    }
                });

                await this.page.click('#totp');

                const isFocused = await this.page.evaluate(() => {
                    return document.activeElement && document.activeElement.id === 'totp';
                });

                if (isFocused) {
                    console.log(`第 ${attempt} 次嘗試 focus 成功`);
                    focusSuccess = true;
                    break;
                }
            } catch (error) {
                console.log(`第 ${attempt} 次嘗試 focus 失敗:`, error.message);
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (!focusSuccess) {
            console.warn('無法設定 OTP 輸入框 focus，但繼續執行');
        }
    }

    async waitForBookingTime() {
        // 設定 dialog 處理
        this.page.on('dialog', async (dialog) => {
            console.log('dialog detected');
            await dialog.accept();
        });

        // 等待頁面載入
        await this.page.waitForSelector('#i_container > #right > div > a > img', { timeout: 0 });

        // 檢查使用者權限
        const fullName = await this.page.evaluate(() => {
            const container = document.getElementById('left');
            if (container) {
                const element = container.querySelector('span[style="color:#194D93"]');
                return element ? element.innerText : '';
            }
            return '';
        });
        console.log('使用者名稱:', fullName);

        const limitUser = ['謝銘泰', '莊定軒', '施銘原', '許明風', '陳尚逸', '楊志傑', '劉冠逸', '高紹軒', '林昌松', '郭宗益'];
        
        if (!limitUser.includes(fullName)) {
            throw new Error('系統有限制訂房使用者!');
        }

        // 無限點擊搶訂第40天
        while (true) {
            console.log('點擊 [搶訂第40天]');
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();

            // 判斷是否需要調整點擊頻率
            if (hours === 7) {
                if (minutes < 55) {
                    console.log('目前時間: ' + now.toLocaleTimeString() + '，每45秒點擊一次');
                    await new Promise(resolve => setTimeout(resolve, 45000));
                } else if (minutes < 59) {
                    console.log('目前時間: ' + now.toLocaleTimeString() + '，每30秒點擊一次');
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else if (minutes === 59 && seconds < 30) {
                    console.log('目前時間: ' + now.toLocaleTimeString() + '，每5秒點擊一次');
                    await new Promise(resolve => setTimeout(resolve, 5000));
                } else {
                    console.log('目前時間: ' + now.toLocaleTimeString() + '，開始無限點擊');
                }
            }

            try {
                await this.page.click('#i_container > #right > div > a > img');
            } catch (e) {
                console.log('(例外)點擊 [搶訂第40天]');
            }

            try {
                console.log('(最多等待200微秒) 看有無跳轉到會館列表');
                await this.page.waitForSelector('img[src="../images/hotel-bottom.gif"]', { timeout: 200 });
                console.log('已跳轉到會館列表');
                break;
            } catch (e) {
                console.log('(例外)還沒換頁');
            }
        }
    }

    async selectHotel() {
        const { book_hotel_name } = this.config;
        
        const tr_length = await this.page.$$eval('table[width="100%"] > tbody > tr', (tr) => tr.length);
        console.log('(取得會館列表長度)' + tr_length);

        for (var i = 0; i < tr_length; i++) {
            const hotel_name = await this.page.$eval(
                'table[width="100%"] > tbody > tr:nth-child(' + (i + 1) + ') > td > a > span',
                (td) => td.innerHTML
            );

            if (book_hotel_name == hotel_name) {
                console.log('找到了(' + hotel_name + ')' + (i + 1));
                    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 100));
                await this.page.click('table[width="100%"] > tbody > tr:nth-child(' + (i + 1) + ') > td > a > span');
                console.log('點擊了(' + hotel_name + ')' + (i + 1));
                break;
            }
        }
    }

    async selectRooms() {
        const { room_no } = this.config;
        
        await this.page.waitForSelector('img[src="../images/submitorder.gif"]', { timeout: 0 });
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));

        await this.page.evaluate((room_no) => {
            var tr = document.querySelectorAll('table[width="100%"] > tbody > tr');
            for (var i = 0; i < tr.length - 1; i++) {
                var td_text = tr[i].querySelector('td:nth-child(2) > span').innerHTML;
                if (room_no.indexOf(td_text) >= 0) {
                    console.log('選擇房間: ' + td_text);
                    tr[i].querySelector('td:nth-child(5) > input').click();
                }
            }
        }, room_no);

        // 點擊確認按鈕
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 50));
        await this.page.click('img[src="../images/submitorder.gif"]');
        
        console.log('訂房完成！');
        
        // 等待結果
        await this.browser.waitForTarget(() => false, { timeout: 30000 }).catch(() => {
            console.log('訂房流程結束');
        });
    }

    async run() {
        try {
            console.log('開始執行爬蟲...');
            await this.init();
            await this.login();
            await this.handleOTPVerification();
            await this.waitForBookingTime();
            await this.selectHotel();
            await this.selectRooms();
            console.log('爬蟲執行完成');
        } catch (error) {
            console.error('爬蟲執行錯誤:', error);
            throw error;
        } finally {
            // 確保停止監控
            this.stopSmsMonitoring();
            
            if (this.browser) {
                await this.browser.close();
                console.log('瀏覽器已關閉');
            }
        }
    }
}

// 如果直接執行此檔案
if (require.main === module) {
    const crawler = new HotelBookingCrawler();
    crawler.run().catch(console.error);
}

module.exports = HotelBookingCrawler;
