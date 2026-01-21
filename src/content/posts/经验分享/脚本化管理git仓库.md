---
title: Git自动化提交脚本指南
published: 2025-04-23
description: 在日常开发中，我们常常需要反复执行git add、commit、push这一系列操作。本文将介绍两个开箱即用的自动化脚本，助你告别重复劳动，提升版本控制效率。
tags: [Git, 自动化, 脚本]
category: 经验分享
draft: false
---

# 1. Windows 环境

在目标文件夹内，创建一个新的`.bat`文件然后输入以下内容：

```bat
@echo off
chcp 65001 >nul
echo Checking Git repository...
git status >nul 2>&1
if errorlevel 1 (
    echo Error: Not a Git repository or Git not installed
    timeout /t 3 >nul
    exit /b 1
)

:input
set /p commit_message="Enter commit message (default: Auto commit): "
if "%commit_message%"=="" (
    set commit_message="Auto commit at %date% %time%"
)

echo Staging changes...
git add . >nul
if errorlevel 1 (
    echo Error: Failed to stage files
    timeout /t 3 >nul
    exit /b 1
)

echo Committing changes...
git commit -m %commit_message% >nul
if errorlevel 1 (
    echo Notice: No changes to commit
    goto retry
)

echo Pushing to remote...
git push >nul
if errorlevel 1 (
    echo Error: Push failed
    timeout /t 3 >nul
    exit /b 1
)

echo Successfully committed and pushed!
timeout /t 3 >nul
exit /b 0

:retry
choice /c yn /m "Retry with empty commit? (y/n)"
if errorlevel 2 exit /b 1
git commit --allow-empty -m %commit_message%
goto :eof
```



# 2. Linux 环境

在目标文件夹内，创建一个新的`git-autocommit.sh`文件然后输入以下内容：

```sh
# Function to check Git status
check_git_repo() {
    git status >/dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Error: Not a Git repository or Git not installed" >&2
        exit 1
    fi
}

# Function to handle commit
perform_commit() {
    git commit -m "$1" >/dev/null 2>&1
    return $?
}

# Main execution
check_git_repo

# Get commit message
read -r -p "Enter commit message (default: Auto commit): " commit_message
if [ -z "$commit_message" ]; then
    commit_message="Auto commit at $(date '+%Y-%m-%d %H:%M:%S')"
fi

# Stage changes
echo "Staging changes..."
git add . >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Failed to stage files" >&2
    exit 1
fi

# Commit changes
if ! perform_commit "$commit_message"; then
    echo "Notice: No changes to commit"
    read -r -p "Retry with empty commit? (y/n): " retry_choice
    case "$retry_choice" in
        [yY]|[yY][eE][sS])
            git commit --allow-empty -m "$commit_message" >/dev/null 2>&1
            if [ $? -ne 0 ]; then
                echo "Error: Empty commit failed" >&2
                exit 1
            fi
            ;;
        *)
            exit 1
            ;;
    esac
fi

# Push changes
echo "Pushing to remote..."
git push >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "Error: Push failed" >&2
    exit 1
fi

echo "Successfully committed and pushed!"
```



**使用方式：**

```sh
chmod +x git-autocommit.sh

./git-autocommit.sh
```

