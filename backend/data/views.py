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

def _parse_json_body(request, *, required_key="content", must_be_object=True):
    raw = request.body or b""
    if len(raw) > JSON_MAX_BYTES:
        raise ValueError(f"body too large (>{JSON_MAX_BYTES} bytes)")

    try:
        data = json.loads(raw.decode("utf-8") if raw else "{}")
    except json.JSONDecodeError as e:
        raise ValueError(f"invalid JSON: {str(e)}")

    if required_key not in data:
        raise ValueError(f"missing field: {required_key}")

    content = data[required_key]
    if must_be_object and not isinstance(content, dict):
        raise ValueError("content must be a JSON object")

    return content

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
        items = list(Data.objects.values("id", "content"))
        return JsonResponse(items, safe=False, status=200)

    if request.method == "POST":
        try:
            content = _parse_json_body(request)
        except ValueError as e:
            return _json_error(400, str(e))
        obj = Data.objects.create(content=content)
        return JsonResponse({"id": obj.id, "content": obj.content}, status=201)

    return HttpResponseNotAllowed(["GET", "POST", "OPTIONS"])

@csrf_exempt
def data_detail(request, pk: int):
    if request.method == "OPTIONS":
        return _options_ok()

    obj = get_object_or_404(Data, pk=pk)

    if request.method == "GET":
        return JsonResponse({"id": obj.id, "content": obj.content}, status=200)

    if request.method in ("PUT", "PATCH"):
        try:
            content = _parse_json_body(request)
        except ValueError as e:
            return _json_error(400, str(e))
        # 這裡 PUT/PATCH 都採「覆寫」策略；若想 PATCH 部分合併，可改成 dict 合併
        obj.content = content
        obj.save(update_fields=["content"])
        return JsonResponse({"id": obj.id, "content": obj.content}, status=200)

    if request.method == "DELETE":
        obj.delete()
        return HttpResponse(status=204)

    return HttpResponseNotAllowed(["GET", "PUT", "PATCH", "DELETE", "OPTIONS"])
