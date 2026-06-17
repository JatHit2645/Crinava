FROM python:3.10-slim

# Install system dependencies for curl_cffi and health check
RUN apt-get update && apt-get install -y \
    curl \
    libnss3 \
    libnss3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create a non-root user for container security
RUN useradd -m appuser

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application and set ownership to non-root user
COPY --chown=appuser:appuser . .

# Switch to the non-root user
USER appuser

# Expose the port FastAPI runs on
EXPOSE 7860

# Add Healthcheck instruction to verify container state
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:7860/ || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
