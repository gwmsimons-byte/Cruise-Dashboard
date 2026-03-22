FROM python:3.11-slim

# Installeer systeem-afhankelijkheden (eccodes voor GRIB files)
RUN apt-get update && apt-get install -y \
    libeccodes0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Werkmap instellen
WORKDIR /app

# Kopieer requirements en installeer python packages
COPY api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Kopieer de rest van de applicatie (www en api mappen)
COPY api /app/api
COPY www /app/www

# Exposeer de poort die uvicorn gaat gebruiken (Koyeb luistert meestal naar 8000 of 8080)
EXPOSE 8000

# Start de applicatie vanuit de api map
WORKDIR /app/api
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
