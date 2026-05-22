FROM python:3.12-slim

WORKDIR /app
COPY catersync-backend/requirements/base.txt requirements/base.txt
RUN pip install --no-cache-dir -r requirements/base.txt
COPY catersync-backend/ .
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
