import json
from django.http import JsonResponse, HttpResponse, HttpResponseNotAllowed
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from .models import Data

JSON_MAX_BYTES = 256 * 1024  # 例：限制 256 KB

def _json_error(status, message, extra=None):
    payload = {"error": message}
    if extra:
        payload.update(extra)
    return JsonResponse(payload, status=status)

def _parse_json_body(request, *, required_key="text"):
    raw = request.body or b""
    if len(raw) > JSON_MAX_BYTES:
        raise ValueError(f"body too large (>{JSON_MAX_BYTES} bytes)")

    try:
        data = json.loads(raw.decode("utf-8") if raw else "{}")
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {str(e)}")

    if required_key not in data:
        raise ValueError(f"missing field: {required_key}")

    value = data[required_key]
    if not isinstance(value, str):
        raise ValueError(f"{required_key} must be a string")

    return value.strip()

def _options_ok():
    # 同源代理下其實用不到，但保留不會有壞處
    resp = HttpResponse(status=200)
    resp["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return resp

@csrf_exempt
def data_collection(request):
    if request.method == "OPTIONS":
        return _options_ok()

    if request.method == "GET":
        items = list(Data.objects.values("id", "text", "created_at", "updated_at"))
        return JsonResponse(items, safe=False, status=200)

    if request.method == "POST":
        try:
            text = _parse_json_body(request)
        except ValueError as e:
            return _json_error(400, str(e))
        obj = Data.objects.create(text=text)
        return JsonResponse({
            "id": obj.id,
            "text": obj.text,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }, status=201)

    return HttpResponseNotAllowed(["GET", "POST", "OPTIONS"])

@csrf_exempt
def data_detail(request, pk: int):
    if request.method == "OPTIONS":
        return _options_ok()

    obj = get_object_or_404(Data, pk=pk)

    if request.method == "GET":
        return JsonResponse({
            "id": obj.id,
            "text": obj.text,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }, status=200)

    if request.method in ("PUT", "PATCH"):
        try:
            text = _parse_json_body(request)
        except ValueError as e:
            return _json_error(400, str(e))
        obj.text = text
        obj.save(update_fields=["text", "updated_at"])
        return JsonResponse({
            "id": obj.id,
            "text": obj.text,
            "created_at": obj.created_at,
            "updated_at": obj.updated_at,
        }, status=200)

    if request.method == "DELETE":
        obj.delete()
        return HttpResponse(status=204)

    return HttpResponseNotAllowed(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
