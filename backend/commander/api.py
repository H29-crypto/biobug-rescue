from fastapi import APIRouter
from .models import CommanderRequest
from .service import CommanderService

def create_router(service=None):
    service=service or CommanderService()
    router=APIRouter(prefix='/commander',tags=['Advisory Commander'])
    @router.get('/status')
    def status(): return service.status()
    @router.post('/brief')
    async def brief(request:CommanderRequest): return await service.brief(request)
    return router
