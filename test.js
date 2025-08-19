const HotelBookingCrawler = require('./crawler');
const fs = require('fs');

async function testConfig() {
    console.log('=== 設定檔測試 ===');
    
    try {
        const crawler = new HotelBookingCrawler();
        crawler.loadConfig();
        
        const config = crawler.config;
        
        if (!config.user_name || config.user_name === '請填入您的中華電信帳號') {
            console.error('❌ 請填入正確的使用者名稱');
            return false;
        }
        
        if (!config.user_pass || config.user_pass === '請填入您的密碼') {
            console.error('❌ 請填入正確的密碼');
            return false;
        }
        
        if (!config.book_hotel_name) {
            console.error('❌ 請選擇要訂的會館');
            return false;
        }
        
        if (!config.room_no || config.room_no.length === 0) {
            console.error('❌ 請選擇要訂的房號');
            return false;
        }
        
        console.log('✅ 設定檔檢查通過');
        console.log(`使用者: ${config.user_name}`);
        console.log(`會館: ${config.book_hotel_name}`);
        console.log(`房號: ${config.room_no.join(', ')}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 設定檔載入失敗:', error.message);
        return false;
    }
}

async function testSMSMonitoring() {
    console.log('\n=== 簡訊監控測試 ===');
    console.log('測試 sms_code 欄位變化監控功能');
    console.log('');
    
    const crawler = new HotelBookingCrawler();
    crawler.loadConfig();
    
    let detected = false;
    let detectedCode = '';
    
    console.log('目前 sms_code 值:', `"${crawler.config.sms_code}"`);
    console.log('');
    console.log('請按照以下步驟測試:');
    console.log('1. 編輯 config.json 檔案');
    console.log('2. 將 "sms_code": "" 改為 "sms_code": "123456"');
    console.log('3. 儲存檔案');
    console.log('');
    console.log('監控中... (30秒後自動結束)');
    
    crawler.watchConfigFile((smsCode) => {
        console.log('✅ 成功偵測到簡訊驗證碼變化!');
        console.log('收到的驗證碼:', smsCode);
        detected = true;
        detectedCode = smsCode;
        
        // 停止監控
        fs.unwatchFile(crawler.configPath);
    });
    
    // 等待 30 秒
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // 清理監控
    fs.unwatchFile(crawler.configPath);
    
    if (detected) {
        console.log(`\n✅ 監控測試成功! 偵測到驗證碼: ${detectedCode}`);
        
        // 自動清空驗證碼
        crawler.config.sms_code = '';
        fs.writeFileSync(crawler.configPath, JSON.stringify(crawler.config, null, 2));
        console.log('✅ 已自動清空驗證碼');
        
    } else {
        console.log('\n⚠️  未偵測到 sms_code 變化');
        console.log('請確認:');
        console.log('- 是否有編輯並儲存 config.json 檔案');
        console.log('- sms_code 是否從空字串變為有值');
    }
}

async function main() {
    console.log('中華電信會館訂房爬蟲 - 設定測試');
    console.log('=====================================\n');
    
    const configValid = await testConfig();
    
    if (configValid) {
        await testSMSMonitoring();
    }
    
    console.log('\n測試完成');
}

if (require.main === module) {
    main().catch(console.error);
}
