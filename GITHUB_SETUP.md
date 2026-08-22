# GitHub Setup

## Create repository
Name: `TripMate`

## Initialize local repository
```bash
git init
git branch -M main
git add .
git commit -m "chore: initialize TripMate project"
```

## Connect remote
```bash
git remote add origin https://github.com/YOUR_USERNAME/TripMate.git
git push -u origin main
```

## Create develop branch
```bash
git checkout -b develop
git push -u origin develop
```

## First feature branch
```bash
git checkout develop
git checkout -b feature/TRIP-101-authentication
```
