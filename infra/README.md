# Serverless Side Project：聯絡表單 + Cognito 管理端

這個 side project 用 **API Gateway (HTTP API) + Lambda + DynamoDB (On-Demand) + Cognito**：

- 公開端：`POST /contact`（聯絡表單送出訊息）
- 管理端：`GET /admin/messages`（需 Cognito 登入，帶 JWT）

## 架構

- **HTTP API**：比 REST API 便宜
- **Lambda (arm64)**：更省錢
- **DynamoDB PAY_PER_REQUEST**：沒流量就幾乎不花錢
- **Cognito User Pool + Hosted UI**：管理端登入（OAuth Authorization Code + PKCE）
- **HTTP API JWT Authorizer**：驗證 `Authorization: Bearer <id_token>`

## 前置

- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) 並設定好 credentials（`aws configure`）
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam.html)
- **Docker Desktop**（建議）：用於 `sam build --use-container`，在 Windows 上建出與 Lambda 相容的 arm64 套件

> Docker 不能取代 SAM CLI；Docker 是讓 **build** 在 Linux 容器內完成。部署仍用 `sam deploy`。

## 部署（在 `infra/` 目錄）

```powershell
cd infra
sam build --use-container
sam deploy --guided
```

`--guided` 時建議參數：

| 參數 | 建議值 |
|------|--------|
| `AllowedOrigin` | `https://www.azhe.uk`（你的網域，不要用 `*`） |
| `CognitoDomainPrefix` | 全域唯一前綴，例如 `azhe-resume-admin` |
| `AdminCallbackUrl` | `https://www.azhe.uk/admin/index.html` |
| `AdminLogoutUrl` | `https://www.azhe.uk/admin/index.html` |

部署完成後記下 **Outputs**：

- `ContactEndpoint` → 填到 `js/profile.js` 的 `contactApiUrl`
- `AdminMessagesEndpoint` → 填到 `adminMessagesApiUrl`
- `AdminUserPoolClientId` → 填到 `cognitoAdminAuth.clientId`
- `AdminHostedUiBaseUrl` → 從網址取出 `domainPrefix`（`https://<prefix>.auth.<region>.amazoncognito.com`）

## 建立第一個管理員帳號

部署後到 **Cognito 控制台** → User Pool → Users → Create user（或用 CLI）：

```bash
aws cognito-idp admin-create-user ^
  --user-pool-id <AdminUserPoolId> ^
  --username admin@example.com ^
  --user-attributes Name=email,Value=admin@example.com Name=email_verified,Value=true ^
  --temporary-password "TempPass123!@#" ^
  --message-action SUPPRESS
```

首次用 Hosted UI 登入時會要求改密碼。

## 前端設定（`js/profile.js`）

```javascript
contactApiUrl: "https://xxxx.execute-api.us-east-1.amazonaws.com/contact",
adminMessagesApiUrl: "https://xxxx.execute-api.us-east-1.amazonaws.com/admin/messages",
cognitoAdminAuth: {
  region: "us-east-1",
  domainPrefix: "azhe-resume-admin",
  clientId: "<AdminUserPoolClientId>",
  redirectUri: "https://www.azhe.uk/admin/index.html",
  logoutUri: "https://www.azhe.uk/admin/index.html",
},
```

## 管理頁使用方式

1. 開啟 `https://www.azhe.uk/admin/index.html`
2. 按 **登入** → 跳轉 Cognito Hosted UI
3. 登入成功後自動載入聯絡表單訊息

## API 測試

### 聯絡表單（公開）

```bash
curl -X POST "<ContactEndpoint>" \
  -H "content-type: application/json" \
  -d "{\"name\":\"A\",\"email\":\"a@example.com\",\"company\":\"ACME\",\"message\":\"hi\"}"
```

### 管理端讀訊息（需 JWT）

先從瀏覽器登入管理頁，在 DevTools → Application → Session Storage 查看 `resume_admin_tokens` 裡的 `id_token`，再：

```bash
curl "<AdminMessagesEndpoint>?limit=30" \
  -H "Authorization: Bearer <id_token>"
```

## 防刷與安全

- **Honeypot**：`website` 有值就假裝成功
- **每 IP 每小時限額**：> 5 次回 `429`
- **管理端**：Cognito JWT（取代舊版 `x-admin-key`）

可再加強：reCAPTCHA / Turnstile、WAF、Cognito MFA。

## 遷移到另一個 AWS 帳號（例如 jjluo2）

Cognito User Pool **無法跨帳號搬家**，要在新帳號重新 `sam deploy`。

**重要：** Cognito 網域前綴 `azhe-resume-admin` 在同一 region **全域唯一**。若舊帳號還佔著，新帳號 deploy 會失敗，需**先刪舊 stack** 或改用新前綴。

### 步驟

1. **在新帳號建立 IAM 使用者 + Access Key**（jjluo2 / `939141785878`）
2. **設定本機 profile：**
   ```powershell
   aws configure --profile jjluo2
   aws sts get-caller-identity --profile jjluo2
   ```
   確認 `Account` 為 `939141785878`。
3. **刪除舊帳號 stack（釋放 Cognito 網域）：**
   ```powershell
   sam delete --stack-name resume-website-api --profile default
   ```
4. **在新帳號部署：**
   ```powershell
   cd infra
   sam build --use-container --profile jjluo2
   sam deploy --profile jjluo2
   ```
5. **建立管理員：**
   ```powershell
   aws cognito-idp admin-create-user --profile jjluo2 ...
   ```
6. **更新 `js/profile.js` 的 API URL / clientId**，push 前端。
