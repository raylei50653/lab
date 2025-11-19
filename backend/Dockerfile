FROM python:3.12-slim AS runtime

# ===== APT / PyPI 參數 =====
ARG DEBIAN_MIRROR=https://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=https://deb.debian.org/debian-security
ARG DEBIAN_SUITE=trixie
ARG DEBIAN_UPDATES_SUITE=trixie-updates
ARG DEBIAN_SECURITY_SUITE=trixie-security

ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_EXTRA_INDEX_URL=
ARG PIP_TRUSTED_HOST=

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_EXTRA_INDEX_URL=${PIP_EXTRA_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

WORKDIR /app

# SQLite 預設資料夾（也可以搭配 volume）
RUN mkdir -p /app/db

# 先只複製 requirements，讓依賴變動才重建這層
COPY backend/requirements.txt /tmp/requirements.txt

# 單一 RUN：設定 APT source、裝編譯工具 + runtime lib、pip install、清理
RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources; \
    { \
        echo "deb ${DEBIAN_MIRROR} ${DEBIAN_SUITE} main"; \
        echo "deb ${DEBIAN_MIRROR} ${DEBIAN_UPDATES_SUITE} main"; \
        echo "deb ${DEBIAN_SECURITY_MIRROR} ${DEBIAN_SECURITY_SUITE} main"; \
    } > /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libgl1 \
        libglib2.0-0; \
    pip install --no-cache-dir --upgrade pip --root-user-action=ignore; \
    pip install --no-cache-dir -r /tmp/requirements.txt --root-user-action=ignore; \
    apt-get purge -y --auto-remove build-essential; \
    rm -rf /var/lib/apt/lists/* /tmp/requirements.txt

# 這層之後改程式才會重建
COPY backend/ /app

# 建立非 root 使用者
RUN useradd -ms /bin/bash django && \
    chown -R django:django /app && \
    chmod +x /app/docker-entrypoint.sh

USER django

# 可選：讓 /app/db 綁 volume，比較不會把 SQLite 鎖死在 image 內
VOLUME ["/app/db"]

EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
