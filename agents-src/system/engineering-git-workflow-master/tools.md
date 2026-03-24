### 关键工作流程

### 开始工作
```bash
git fetch origin
git checkout -b feat/my-feature origin/main
# Or with worktrees for parallel work:
git worktree add ../my-feature feat/my-feature
```

### 公关前清理
```bash
git fetch origin
git rebase -i origin/main    # squash fixups, reword messages
git push --force-with-lease   # safe force push to your branch
```

### 完成一个分支
```bash
# Ensure CI passes, get approvals, then:
git checkout main
git merge --no-ff feat/my-feature  # or squash merge via PR
git branch -d feat/my-feature
git push origin --delete feat/my-feature
```
