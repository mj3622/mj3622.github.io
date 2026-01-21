---
title: Git常用指令
published: 2024-09-15
description: 本文将介绍Git的常用指令，便于初学者随时查找相关的指令，作者将结合自己的经验进行更新
tags: [Git, 版本控制]
category: 编程实践
draft: false
---

# 0. 安装git

1. 在官网下载git

2. 打开Git Bash，若打开则说明安装成功

3. 使用命令设置id和email

   ```sh
   git config --global user.name "Your Name"
   git config --global user.email "email@example.com"
   ```



# 1. 本地操作

**创建一个版本库：**

1. 先使用命令行移动至目标文件夹
2. 使用`git init`将其变为Git可以管理的仓库



**将文件提交给仓库：**

1. 确认文件处于仓库的目录之下
2. 使用命令`git add filename1.txt filename2.txt`
3. 使用命令`git commit -m "introduction"`



**查看仓库的状态：**`git status`

**查看有什么修改：**`git diff`

**查看历史记录：**	`git log`

**查看分支合并图：**`git log --graph`

**单行显示历史记录：**`git log --pretty=oneline`

**回退到原来的某个版本：**`git reset --hard HEAD~n`，n表示n个版本之前，或直接`HEAD^`有几个^表示在几个版本前

**将文件更改至某次提交的版本：**`git reset --hard 1094a`，“1094a”为你更改的目标版本的前几位版本号

**查看历史命令指令：**`git reflog`



**当文件还没有add进缓存区时，想撤销至最开始的版本：**`git restore filename`

**当文件已经add进缓存区后，想从缓存区撤销：**`git reset HEAD <file>`



**删除文件的操作：**

1. 手动或使用命令（del）删除本地文件
2. 如果要确认删除那么就`add/rm filename`再commit即可
3. 若是误删想撤销操作只需要`git restore filename`



**将文件移出版本控制，但保留本地文件：**

1. 移除追踪文件`git rm --cached <file>`
2. 将文件添加至`.gitignore`
3. 提交更改`git commit -m "Stop tracking example.txt"`



**创建并切换新的分支：**

- `git switch -c dev或git checkout -b dev`直接创新并切换至新分支dev
- 或者使用两条命令来分别执行：`创建git branch dev 转换git switch dev`



**合并某分支到当前分支：**`git merge <branch-name>`,默认采用Fast forword模式

**不采用FF模式进行合并：**`git merge --no-ff <branch-name>`

**两者的区别：** 采用FF模式在log图中看起来就是一条直线过去，而不采用FF模式就会有分支，可以看出是从分支提交过去的

**删除分支：**`git branch -d <branch-name>`

**强行删除还没有合并过的分支：**`git branch -D <branch-name>`



**暂存工作现场：**`git stash`

**查看暂存工作现场列表：**`git stash list`

**恢复同时删除工作现场：**`git stash pop`

**恢复工作现场：**`git stash apply stash@{0}`，可指定恢复某个现场

**删除工作现场：**`git stash drop`

**将其他分支的改动复制过来（例如修bug）：**`git cherry-pick <commit-id>`，注意要在恢复现场前使用



**变基：**`git rebase`



**创建标签：**`git tag <tag-name>`，可在后边加上某次commit的id用于对指定commit创建标签

**创建带注释的标签：**`git tag -a <tag-name> -m <introduction>`

**查看所有标签：**`git tag`

**删除标签：**`git -d <tag-name>`

**向远程推送标签：**`git push origin <tag-name>`

**一次性将所有标签推送到远程：**`git push origin --tags`

**删除已推送的远程标签：** 首先现在本地将标签删除，然后再运行`git push origin :refs/tags/<tag-name>`



**配置别名：**`git config --global alias.<别名> <原名>`

# 2. 远程操作

**将本地仓库关联远程仓库：**

`git remote add origin https:`输入仓库对应的连接进行替换



**添加远程仓库：**

1. 在GitHub上新建一个新的仓库，然后获取https或ssh连接
2. 使用`git push -u origin master`将本地库所有内容推送到远程库上去
3. 之后我们只需要使用`git push origin master`



**删除远程库：**

1. 先使用`git remote -v`查看远程仓库
2. 然后根据名字删除远程仓库`git remote rm reponame`



**从远程库克隆：**`git clone repoaddress`，注意克隆之前先cd到目标目录



**向远程推送分支：**`git push origin <branch-name>`

**查看远程库信息：**`git remote -v`

**在本地端创建与远程分支对应的分支：**`git chekout -b <branch-name> origin/<branch-name>`通常本地分支和远程保持一致

**从远程抓取分支：**`git pull`

**建立本地分支与远程分支建立联系：**`git branch --set-upstream <branch-name> origin/<branch-name>`