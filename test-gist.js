const HotelBookingCrawler = require('./crawler');

async function testGistConfig() {
    console.log('=== GitHub Gist 設定檔測試 ===');
    
    try {
        const crawler = new HotelBookingCrawler();
        
        // 檢查是否設定了 Gist URL
        if (!process.env.GIST_URL && crawler.gistUrl.includes('YOUR_GIST_ID')) {
            console.error('❌ 請先設定 GitHub Gist URL');
            console.log('方法1: 設定環境變數 GIST_URL');
            console.log('方法2: 直接修改 crawler.js 中的 gistUrl');
            console.log('');
            console.log('GitHub Gist 設定步驟:');
            console.log('1. 登入 GitHub，前往 https://gist.github.com/');
            console.log('2. 建立新的 Gist，檔名設為 config.json');
            console.log('3. 將 config.example.json 的內容複製貼上');
            console.log('4. 填入您的真實資訊');
            console.log('5. 點選 "Create public gist" 或 "Create secret gist"');
            console.log('6. 複製 Raw URL (點擊 Raw 按鈕後的網址)');
            console.log('7. 將 URL 設定到環境變數或程式中');
            return false;
        }

        console.log('嘗試從 Gist 讀取設定檔...');
        console.log('Gist URL:', crawler.gistUrl);
        
        await crawler.loadConfigFromGist();
        
        const config = crawler.config;
        
        if (!config) {
            console.error('❌ 無法讀取 Gist 設定檔');
            return false;
        }
        
        if (!config.user_name || config.user_name === '請填入您的中華電信帳號') {
            console.error('❌ 請在 Gist 中填入正確的使用者名稱');
            return false;
        }
        
        if (!config.user_pass || config.user_pass === '請填入您的密碼') {
            console.error('❌ 請在 Gist 中填入正確的密碼');
            return false;
        }
        
        if (!config.book_hotel_name) {
            console.error('❌ 請在 Gist 中選擇要訂的會館');
            return false;
        }
        
        if (!config.room_no || config.room_no.length === 0) {
            console.error('❌ 請在 Gist 中選擇要訂的房號');
            return false;
        }
        
        console.log('✅ Gist 設定檔檢查通過');
        console.log(`使用者: ${config.user_name}`);
        console.log(`會館: ${config.book_hotel_name}`);
        console.log(`房號: ${config.room_no.join(', ')}`);
        console.log(`簡訊驗證碼: ${config.sms_code || '(未設定)'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Gist 設定檔測試失敗:', error.message);
        return false;
    }
}

async function testGistSmsMonitoring() {
    console.log('\n=== GitHub Gist 簡訊監控測試 ===');
    console.log('測試 GitHub Gist 中 sms_code 欄位變化監控功能');
    console.log('');
    
    const crawler = new HotelBookingCrawler();
    
    try {
        await crawler.loadConfigFromGist();
        
        let detected = false;
        let detectedCode = '';
        
        console.log('目前 Gist 中的 sms_code 值:', `"${crawler.config.sms_code || ''}"`);
        console.log('');
        console.log('請按照以下步驟測試:');
        console.log('1. 前往您的 GitHub Gist 頁面');
        console.log('2. 點擊 "Edit" 編輯 Gist');
        console.log('3. 將 "sms_code": "" 改為 "sms_code": "123456"');
        console.log('4. 點擊 "Update public gist" 或 "Update secret gist"');
        console.log('');
        console.log('監控中... (60秒後自動結束)');
        
        crawler.startSmsMonitoring((smsCode) => {
            console.log('✅ 成功偵測到 Gist 中的簡訊驗證碼變化!');
            console.log('收到的驗證碼:', smsCode);
            detected = true;
            detectedCode = smsCode;
        });
        
        // 等待 60 秒
        await new Promise(resolve => setTimeout(resolve, 60000));
        
        // 停止監控
        crawler.stopSmsMonitoring();
        
        if (detected) {
            console.log(`\n✅ Gist 監控測試成功! 偵測到驗證碼: ${detectedCode}`);
        } else {
            console.log('\n⚠️  未偵測到 Gist 中的 sms_code 變化');
            console.log('請確認:');
            console.log('- 是否有正確編輯並更新 GitHub Gist');
            console.log('- sms_code 是否從空字串變為有值');
            console.log('- 網路連線是否正常');
        }
        
    } catch (error) {
        console.error('❌ Gist 監控測試失敗:', error.message);
    }
}

async function main() {
    console.log('中華電信會館訂房爬蟲 - GitHub Gist 測試');
    console.log('==========================================\n');
    
    const configValid = await testGistConfig();
    
    if (configValid) {
        await testGistSmsMonitoring();
    }
    
    console.log('\n測試完成');
}

if (require.main === module) {
    main().catch(console.error);
}
