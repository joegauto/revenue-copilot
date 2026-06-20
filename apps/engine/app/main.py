from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.scoring.router import router as scoring_router
from app.agents.router import router as agent_router
from app.demo import demo_router

app = FastAPI(
    title="Revenue Copilot Engine",
    description="Motor de IA para gestión comercial autónoma",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scoring_router)
app.include_router(agent_router)
app.include_router(demo_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "revenue-copilot-engine"}
