import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import CORS_ORIGINS, TEMP_DIR, UPLOAD_DIR, PROCESSED_DIR
from app.routers import pdf_router
from app.routers import command_router
from app.routers import ai_router
from app.services.file_service import file_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for the FastAPI application."""
    # Startup
    print("Starting PDF Buddy API...")

    # Start background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())

    yield

    # Shutdown
    print("Shutting down PDF Buddy API...")
    cleanup_task.cancel()


async def periodic_cleanup():
    """Periodically clean up expired files."""
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            cleaned = await file_service.cleanup_expired_files()
            if cleaned > 0:
                print(f"Cleaned up {cleaned} expired files")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Cleanup error: {e}")


app = FastAPI(
    title="PDF Buddy API",
    description="Comprehensive PDF Editor API with annotation tools",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pdf_router)
app.include_router(command_router.router)
app.include_router(ai_router.router)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "pdf-buddy"}


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "PDF Buddy API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
