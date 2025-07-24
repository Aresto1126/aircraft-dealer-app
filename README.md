# 航空機ディーラー統計アプリ

FiveMサーバー用の航空機ディーラー管理システムです。顧客管理、販売記録、在庫管理、金庫管理、販売員管理などの機能を提供します。

## 🌟 主な機能

### 📊 ダッシュボード
- 顧客一覧の表示
- 売上統計の確認
- 金庫残高の管理

### 👥 顧客管理
- 顧客情報の登録・管理
- 購入履歴の追跡
- 機種別所有状況の表示

### ✈️ 航空機管理
- 航空機データベース
- 販売記録の管理
- 在庫管理システム

### 💰 販売管理
- 複数台販売対応
- 割引機能（1台分）
- プレゼント機能
- 在庫優先販売

### 🏦 金庫管理
- 収支の記録
- 履歴の表示
- 残高調整機能

### 👨‍💼 販売員管理
- 雇用・解雇機能
- 給与計算（販売額の30%）
- 給与支払い管理

### 🔄 Firebase同期
- リアルタイムデータ同期
- 複数ユーザー間でのデータ共有
- 自動バックアップ

## 🚀 デプロイ方法

### GitHub Actions + Firebase Hosting

1. **GitHubリポジトリの作成**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/aircraft-dealer-app.git
   git push -u origin main
   ```

2. **Firebase CLIのインストール**
   ```bash
   npm install -g firebase-tools
   ```

3. **Firebaseプロジェクトの設定**
   ```bash
   firebase login
   firebase init hosting
   ```

4. **GitHub Secretsの設定**
   - GitHubリポジトリのSettings > Secrets and variables > Actions
   - `FIREBASE_TOKEN`を追加（`firebase login:ci`で取得）

5. **自動デプロイの確認**
   - mainブランチにプッシュすると自動的にFirebase Hostingにデプロイされます

## 📁 ファイル構成

```
統計アプリ/
├── index.html          # メインHTMLファイル
├── script.js           # メインJavaScriptファイル
├── style.css           # スタイルシート
├── firebase.json       # Firebase設定
├── .firebaserc         # Firebaseプロジェクト設定
├── .github/workflows/  # GitHub Actions設定
│   └── deploy.yml
└── README.md           # このファイル
```

## 🔧 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript (ES6+)
- **UIフレームワーク**: Bootstrap 5
- **アイコン**: Font Awesome
- **データベース**: Firebase Firestore
- **ホスティング**: Firebase Hosting
- **CI/CD**: GitHub Actions

## 🔄 Firebase同期機能

### リアルタイム同期
- 複数のユーザーが同時にデータを編集可能
- 変更はリアルタイムで他のユーザーに反映
- 競合解決機能付き

### データ保護
- ローカルストレージとの併用
- オフライン対応
- 自動バックアップ機能

## 📊 データ構造

### 顧客データ
```javascript
{
  id: number,
  name: string,
  createdAt: string,
  lastModified: number
}
```

### 航空機データ
```javascript
{
  id: number,
  name: string,
  price: number,
  customerId: number,
  purchaseDate: string,
  lastModified: number
}
```

### 販売データ
```javascript
{
  id: number,
  customerName: string,
  aircraftName: string,
  quantity: number,
  totalPrice: number,
  salespersonId: number,
  saleDate: string,
  lastModified: number
}
```

## 🎯 使用方法

1. **初回セットアップ**
   - システム設定からFirebase接続テストを実行
   - サンプルデータを作成して機能をテスト

2. **販売登録**
   - 販売追加から新しい販売を登録
   - 顧客情報は自動で作成・更新

3. **データ管理**
   - エクスポート/インポート機能でデータをバックアップ
   - Firebase同期で複数ユーザー間でデータを共有

## 🔒 セキュリティ

- Firebase Authentication（必要に応じて追加可能）
- Firestore Security Rules
- データの暗号化（Firebase標準）

## 📈 パフォーマンス

- ローカルストレージによる高速読み込み
- Firebase Firestoreのリアルタイム同期
- 効率的なデータ構造

## 🤝 貢献

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 📞 サポート

問題や質問がある場合は、GitHubのIssuesページでお知らせください。

---

**開発者**: FiveM Server Management Team  
**バージョン**: 2.0.0  
**最終更新**: 2024年12月 