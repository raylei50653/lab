FROM python:3.12-slim AS runtime

ARG DEBIAN_MIRROR=https://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=https://deb.debian.org/debian-security
ARG DEBIAN_SUITE=trixie
ARG DEBIAN_UPDATES_SUITE=trixie-updates
ARG DEBIAN_SECURITY_SUITE=trixie-security

ARG PIP_INDEX_URL=https://pypi.org/simple
ARG PIP_EXTRA_INDEX_URL=
ARG PIP_TRUSTED_HOST=

ENV PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_EXTRA_INDEX_URL=${PIP_EXTRA_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN mkdir -p /app/db

RUN set -eux; \
    rm -f /etc/apt/sources.list.d/debian.sources; \
    printf "deb %s %s main\n" "${DEBIAN_MIRROR}" "${DEBIAN_SUITE}" > /etc/apt/sources.list; \
    printf "deb %s %s main\n" "${DEBIAN_MIRROR}" "${DEBIAN_UPDATES_SUITE}" >> /etc/apt/sources.list; \
    printf "deb %s %s main\n" "${DEBIAN_SECURITY_MIRROR}" "${DEBIAN_SECURITY_SUITE}" >> /etc/apt/sources.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libgl1 \
        libglib2.0-0; \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --upgrade pip --root-user-action=ignore && \
    pip install --no-cache-dir -r /tmp/requirements.txt --root-user-action=ignore

RUN apt-get purge -y --auto-remove build-essential && rm -rf /var/lib/apt/lists/*

COPY backend /app
COPY backend/docker-entrypoint.sh /entrypoint.sh

RUN useradd -ms /bin/bash django && \
    chown -R django:django /app && \
    chmod +x /entrypoint.sh

USER django

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
