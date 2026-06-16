FROM python:3.10-slim

# Install system dependencies for curl_cffi
RUN apt-get update && apt-get install -y \
    curl \
    libnss3 \
    libnss3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port FastAPI runs on
EXPOSE 7860

# Run the application
# We use 7860 because it is the default port for Hugging Face Spaces
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
