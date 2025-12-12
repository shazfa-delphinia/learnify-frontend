#!/usr/bin/env bash
# Menjalankan Gunicorn dengan Uvicorn worker pada port yang disediakan oleh Render
gunicorn ml_server:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT