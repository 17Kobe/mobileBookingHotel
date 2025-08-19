# 自動訂房爬蟲系統

這是一個使用 GitHub Actions 自動執行的中華電信會館訂房爬蟲系統，支援 GitHub Gist 設定檔管理。

## 功能特色

- 🕐 **定時執行**: 每天台北時間 7:30 自動執行
- 📋 **GitHub Gist 設定**: 使用 GitHub Gist 管理登入資訊和訂房設定
- 📱 **自動簡訊監控**: 每5秒自動檢查 Gist 中的簡訊驗證碼變化
- 🔄 **自動化部署**: 使用 GitHub Actions 無須本地環境
- 🔒 **安全性**: 敏感資訊可使用 Private Gist 保護

## 設定說明

### 1. 建立 GitHub Gist

1. 登入 GitHub，前往 [https://gist.github.com/](https://gist.github.com/)
2. 建立新的 Gist，檔名設為 `config.json`
3. 將 `config.example.json` 的內容複製貼上
4. 填入您的真實資訊：

```json
{
  "user_name": "您的中華電信帳號",
  "user_pass": "您的密碼",
  "book_hotel_name": "日月潭會館",
  "room_no": ["206", "208", "209"],
  "sms_code": ""
}
```

5. 點選 "Create public gist" 或 "Create secret gist"
6. 複製 Raw URL (點擊 Raw 按鈕後的網址)

### 2. 設定 Gist URL

#### 方法1: 環境變數設定
```bash
export GIST_URL="https://gist.githubusercontent.com/您的用戶名/您的Gist ID/raw/config.json"
```

#### 方法2: 直接修改程式碼
編輯 `crawler.js`，修改：
```javascript
this.gistUrl = 'https://gist.githubusercontent.com/您的用戶名/您的Gist ID/raw/config.json';
```

### 3. GitHub Actions 設定

在 GitHub 專案的 Settings > Secrets and variables > Actions 中新增：

```
GIST_URL
```

值為您的 Gist Raw URL。

### 2. 可選擇的會館

- 礁溪會館
- 日月潭會館  
- 阿里山會館
- 墾丁會館
- 蘇澳會館
- 金山會館

### 3. 推薦房號

#### 礁溪會館
```json
"room_no": ["301", "302", "303"]
```

#### 日月潭會館
```json
"room_no": ["206", "208", "209", "308", "408", "307", "407", "306", "302", "406", "402", "202"]
```

#### 阿里山會館
```json
"room_no": ["313", "312", "311", "310", "315", "213", "212", "211", "210", "215"]
```

#### 墾丁會館
```json
"room_no": ["309", "307", "305", "311", "303", "301"]
```

#### 蘇澳會館
```json
"room_no": ["501", "301", "201"]
```

#### 金山會館
```json
"room_no": ["501"]
```

## 使用流程

### 自動執行流程

1. **定時觸發**: 每天 7:30 GitHub Actions 自動啟動
2. **自動讀取設定**: 系統從 GitHub Gist 讀取登入資訊和訂房設定
3. **登入驗證**: 系統自動登入並發送簡訊驗證碼
4. **簡訊驗證碼輸入**: 
   - 編輯 GitHub Gist 中的 `config.json`
   - 將收到的簡訊驗證碼填入 `sms_code` 欄位
   - 點擊 "Update gist"
5. **自動訂房**: 系統每5秒檢查 Gist，偵測到驗證碼後自動完成訂房流程

### 手動觸發

1. 進入 GitHub 專案的 Actions 頁面
2. 選擇 "Hotel Booking Crawler" workflow
3. 點擊 "Run workflow" 按鈕

## 簡訊驗證碼輸入方式

當爬蟲執行到需要簡訊驗證碼時：

1. 前往您的 GitHub Gist 頁面
2. 點擊 "Edit" 按鈕
3. 將收到的驗證碼填入 `sms_code` 欄位：
   ```json
   {
     "user_name": "您的帳號",
     "user_pass": "您的密碼",
     "book_hotel_name": "日月潭會館",
     "room_no": ["206", "208", "209"],
     "sms_code": "123456"
   }
   ```
4. 點擊 "Update public gist" 或 "Update secret gist"
5. 系統會在5秒內自動偵測變更並繼續執行

## 本地測試

### 測試 GitHub Gist 設定

```bash
# 安裝依賴
npm install

# 測試 Gist 設定檔讀取
npm run test-gist

# 執行爬蟲
npm start
```

### 測試本地設定檔

```bash
# 複製範例設定檔
cp config.example.json config.json

# 編輯 config.json 填入您的資訊

# 測試設定檔
npm test
```

## 注意事項

- ⚠️ 請確保您的帳號有訂房權限
- ⚠️ 簡訊驗證碼有時效性，請及時在 Gist 中更新
- ⚠️ 建議使用 Private Gist 保護敏感資訊
- ⚠️ GitHub Actions 有執行時間限制（預設 30 分鐘）
- ⚠️ Gist 更新可能有1-2秒延遲，系統會自動重試

## 故障排除

### 檢查執行狀態
1. 進入 GitHub 專案的 Actions 頁面
2. 查看最新的 workflow 執行記錄
3. 點擊查看詳細 log

### 常見問題
- **無法讀取 Gist**: 檢查 Gist URL 是否正確，是否為 Raw URL
- **登入失敗**: 檢查 Gist 中的帳號密碼是否正確
- **權限不足**: 確認帳號在限制使用者名單中
- **驗證碼未偵測**: 確認在 Gist 中正確更新了 sms_code 欄位

## 安全性

- 📊 使用 Private Gist 可保護敏感資訊
- 🔒 建議定期更新密碼和 Gist URL
- 🚫 避免在 Public Gist 中放置真實密碼
