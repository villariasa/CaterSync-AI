# Development Setup

## Backend

```powershell
cd catersync-backend
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver
```

## Flutter

Flutter is still pending on this machine. Install it from an elevated terminal or use the official SDK zip, then verify:

```powershell
flutter --version
flutter doctor
```
