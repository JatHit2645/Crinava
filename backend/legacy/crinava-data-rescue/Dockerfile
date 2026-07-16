FROM python:3.10-slim
WORKDIR /code
COPY . .
RUN pip install --no-cache-dir fastapi uvicorn requests python-dotenv psycopg2-binary pymysql cryptography
EXPOSE 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
