# 一键推送到 GitHub（首次使用前请先在 GitHub 网页端新建空仓库）
# 用法： .\deploy.ps1 -User <你的GitHub用户名> [-Repo xineqidian]
param(
  [Parameter(Mandatory = $true)][string]$User,
  [string]$Repo = 'xineqidian'
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if (-not (Test-Path '.git')) {
  Write-Host '未发现 git 仓库，正在初始化...' -ForegroundColor Yellow
  git init -b main | Out-Null
  git add -A
  git commit -q -m 'feat: 吸能奇点 · 增量放置游戏 v1.0.0'
}

$url = "https://github.com/$User/$Repo.git"
$remotes = @(git remote)
if ($remotes -contains 'origin') {
  git remote set-url origin $url
} else {
  git remote add origin $url
}

git branch -M main

Write-Host "推送到 $url ..." -ForegroundColor Cyan
git push -u origin main

Write-Host ''
Write-Host '✅ 推送完成。最后一步（只需点一次）：' -ForegroundColor Green
Write-Host "   https://github.com/$User/$Repo/settings/pages"
Write-Host '   Build and deployment -> Source 选择 “GitHub Actions”'
Write-Host '   （若 Actions 不可用：改选 “Deploy from a branch” -> main -> / (root)）'
Write-Host ''
Write-Host "🌐 上线地址： https://$User.github.io/$Repo/" -ForegroundColor Green
Write-Host ''
