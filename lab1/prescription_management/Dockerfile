FROM python:3.8-slim

WORKDIR /app

COPY requirements.txt ./

RUN pip install -r requirements.txt

# # Copy all source code to the working directory
# COPY . .

# ARG RECORDS_SERVICE_PORT=50051

# EXPOSE ${RECORDS_SERVICE_PORT}

# # Start your Python service (replace with the actual service file name)
# CMD ["python3", "records_server.py"]