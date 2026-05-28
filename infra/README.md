# Serverless Side Project：聯絡表單（省錢版）

這個 side project 用 **API Gateway (HTTP API) + Lambda + DynamoDB (On-Demand)** 做一個可展示 AWS 能力、同時低成本的功能：

- 公開端：`POST /contact`（聯絡表單送出訊息）
- 管理端：`GET /admin/messages`（用 `x-admin-key` 讀取最新訊息）

## 架構

- **HTTP API**：比 REST API 便宜，足夠用
- **Lambda (arm64)**：更省錢
- **DynamoDB PAY_PER_REQUEST**：沒有流量就幾乎不花錢
- **X-Ray Tracing**：可展示可觀測性

## 部署（AWS SAM）

前置：

- 安裝 AWS CLI、SAM CLI
- 設定好 AWS credentials（或用 GitHub Actions OIDC）

在 `infra/` 資料夾執行：

```bash
sam build
sam deploy --guided
```

部署時建議：

- `AllowedOrigin`：改成你的 CloudFront 網域（不要用 `*`）
- `AdminKey`：填一個強密碼（會用在管理端 header）

部署完成後，你會拿到輸出：

- `ContactEndpoint`：給前端呼叫
- `AdminMessagesEndpoint`：管理端讀訊息

## API 使用方式

### 聯絡表單

```bash
curl -X POST "<ContactEndpoint>" \
  -H "content-type: application/json" \
  -d "{\"name\":\"A\",\"email\":\"a@example.com\",\"company\":\"ACME\",\"message\":\"hi\"}"
```

### 管理端讀訊息

```bash
curl "<AdminMessagesEndpoint>?limit=30" -H "x-admin-key: <你的AdminKey>"
```

## 防刷與安全（目前做了最便宜的基礎版）

- **Honeypot 欄位**：`website` 有值就假裝成功（降低機器人重試）
- **每 IP 每小時限額**：> 5 次回 `429`

你可以再加強：

- 把 `AllowedOrigin` 設為你的實際網域
- 改用 **JWT（Cognito）** 或 **IAM** 來保護管理端
- 前端加 reCAPTCHA / Turnstile

