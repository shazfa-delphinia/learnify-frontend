# ml_server.py (Disesuaikan untuk Production Render)

# --- Hapus Mangum (Tidak diperlukan untuk Render) ---
# from mangum import Mangum 

import os 
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional

# --- Import Logika ML Anda ---
try:
    from ml.chatbot_pipeline import chatbot_pipeline
except ImportError:
    # Penting: Error ini harus ditangani jika file tidak ditemukan
    print("FATAL ERROR: Tidak dapat mengimpor 'chatbot_pipeline'.")
    raise

app = FastAPI(
    title="Learnify ML Pipeline API",
    version="1.0.0"
)

# --- KONFIGURASI CORS ---
app.add_middleware(
    CORSMiddleware,
    # Mengizinkan semua origin saat development/prototype. 
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

# --- Pydantic Model untuk Validasi Request Body ---
class QuizRequest(BaseModel):
    user_interest_answers: List[str]
    user_tech_answers_mcq: Dict[str, str]
    student_id: Optional[str] = None 

# --- Endpoint Health Check (GET) ---
@app.get("/")
def read_root():
    """Endpoint untuk memastikan API berjalan"""
    return {"status": "ok", "message": "ML Pipeline API is running successfully on Render"}

# --- Endpoint Utama Prediksi (POST) ---
@app.post("/predict")
async def predict_learning_path(request: QuizRequest):
    """
    Menerima jawaban kuesioner dan MCQ dari user, 
    kemudian mengembalikan rekomendasi learning path dan modul.
    """
    try:
        result = chatbot_pipeline(
            user_interest_answers=request.user_interest_answers,
            user_tech_answers_mcq=request.user_tech_answers_mcq,
            student_id=request.student_id
        )
        return result
    except Exception as e:
        print(f"Error during ML pipeline execution: {e}") 
        raise HTTPException(
            status_code=500, 
            detail=f"Terjadi kesalahan saat memproses permintaan: {str(e)}"
        )

# --- HAPUS VERCEL HANDLER ---
# handler = Mangum(app) # <--- BARIS INI HILANG