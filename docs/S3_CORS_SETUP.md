# Настройка CORS для S3 Bucket (KnowledgeVault)

> ⏱️ **Время:** 10–15 минут · **Для кого:** Founder (пошагово, без знания AWS)

---

## ⚠️ Сначала прочитайте это — диагноз из логов

Если вы видите ошибку `Network error during S3 upload` и при проверке получаете:

```
HTTP/1.1 403 Forbidden
<Error><Code>AccessForbidden</Code>
<Message>CORSResponse: Bucket not found</Message>
```

**Это НЕ «CORS не настроен». Это значит, что бакета НЕ СУЩЕСТВУЕТ.**

AWS S3 отвечает на OPTIONS-preflight запрос к **несуществующему** бакету именно `403 CORSResponse: Bucket not found` (а не 404 — 404 возвращается только на HEAD/GET). Пока бакет не создан (или имя в настройках Render не совпадает), **никакая CORS-политика не починит загрузку**.

Порядок действий строго такой:
1. **Убедиться, что бакет существует** (раздел 1)
2. **Настроить CORS** (раздел 2 или 3)
3. **Проверить** (раздел 4)

---

## 1. Проверка: существует ли бакет (2 минуты, без credentials)

Откройте терминал и выполните:

```bash
# HEAD-запрос — если бакета нет, будет 404 NoSuchBucket
curl -s -i https://knowledgevault-dev.s3.us-east-1.amazonaws.com/ | head -10

# OPTIONS-preflight — если бакета нет, будет 403 CORSResponse: Bucket not found
curl -s -i -X OPTIONS https://knowledgevault-dev.s3.us-east-1.amazonaws.com/ \
  -H "Origin: https://vorota-znaniy-frontend-one.vercel.app" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" | head -15
```

### Расшифровка ответов

| Ответ | Значение |
|:--|:--|
| `404 NoSuchBucket` | **Бакета нет.** Переходите к шагу «Создать бакет» ниже |
| `403 CORSResponse: Bucket not found` | **Бакета нет** (это стандартный ответ S3 на OPTIONS для несуществующего бакета) |
| `200` без `Access-Control-Allow-Origin` | Бакет есть, CORS не настроен → раздел 2 |
| `200` + `Access-Control-Allow-Origin: https://vorota-znaniy-frontend-one.vercel.app` | Всё уже работает 🎉 |

> 💡 **Проверьте имя бакета в Render!** Откройте Render Dashboard → `knowledgevault-api` → **Environment** → посмотрите `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Если `S3_BUCKET` пуст, бэкенд подставляет имя по умолчанию `knowledgevault-dev` (см. `backend/src/shared/utils/s3.service.ts`). А в прод-шаблоне (`backend/.env.production.example`) используется **Cloudflare R2** (`S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_BUCKET=knowledgevault-staging`) — для R2 инструкции другие (см. `docs/STAGING_SETUP_GUIDE.md` → Step 7).

---

## 2. Настройка CORS через AWS Console (рекомендуется)

> Выполняйте этот раздел **только если** бакет существует (шаг 1 показал, что он есть).

1. Откройте [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Найдите bucket **`knowledgevault-dev`**
3. Перейдите на вкладку **Permissions**
4. Прокрутите до секции **Cross-origin resource sharing (CORS)**
5. Нажмите **Edit**
6. Вставьте следующую конфигурацию (это содержимое файла `infrastructure/s3-cors-policy.json`, но **без обёртки `CORSRules`** — консоль ожидает просто массив):

```json
[
  {
    "AllowedHeaders": [
      "Content-Type",
      "Content-Disposition",
      "x-amz-*"
    ],
    "AllowedMethods": [
      "PUT",
      "GET",
      "POST"
    ],
    "AllowedOrigins": [
      "https://vorota-znaniy-frontend-one.vercel.app",
      "https://vorotaznaniy.onrender.com"
    ],
    "ExposeHeaders": [
      "ETag",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

7. Нажмите **Save changes**
8. Подождите **1–2 минуты** (пропагация CORS в AWS не мгновенная)
9. Проверьте загрузку документа через фронтенд

---

## 3. Настройка CORS через AWS CLI

Если у вас установлен [AWS CLI](https://aws.amazon.com/cli/) с настроенными credentials:

```bash
# Применить политику из файла
aws s3api put-bucket-cors \
  --bucket knowledgevault-dev \
  --cors-configuration file://infrastructure/s3-cors-policy.json

# Проверить, что применилось
aws s3api get-bucket-cors --bucket knowledgevault-dev
```

Или запустите готовый скрипт:

```bash
./scripts/apply-s3-cors.sh
```

---

## 4. Проверка после настройки

```bash
curl -s -i -X OPTIONS https://knowledgevault-dev.s3.us-east-1.amazonaws.com/ \
  -H "Origin: https://vorota-znaniy-frontend-one.vercel.app" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" | head -20
```

**Ожидаемый ответ (успех):**

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://vorota-znaniy-frontend-one.vercel.app
Access-Control-Allow-Methods: PUT, GET, POST
Access-Control-Allow-Headers: Content-Type, Content-Disposition, x-amz-*
Access-Control-Expose-Headers: ETag, x-amz-request-id, x-amz-id-2
Access-Control-Max-Age: 3600
```

Затем проверьте полный цикл в браузере:
1. Откройте `https://vorota-znaniy-frontend-one.vercel.app` → войдите
2. Перейдите на страницу загрузки документа → выберите PDF → «Upload Document»
3. В DevTools (**Network**) убедитесь, что:
   - `POST /v1/documents/upload-init` → **200** (presigned URL)
   - `PUT <presigned-url>` → **200** (файл загружен в S3) — это тот запрос, который раньше падал
   - `POST /v1/documents/{id}/upload-complete` → **200**
4. Документ появляется в списке со статусом **Processing**

---

## 🔧 Troubleshooting

### Всё ещё 403 CORSResponse: Bucket not found после настройки CORS

Бакет точно существует? Проверьте HEAD-запросом (раздел 1). Если `404 NoSuchBucket` — **создайте бакет**:
1. AWS Console → S3 → **Create bucket**
2. Имя: `knowledgevault-dev`, регион: `us-east-1` (должен совпадать с `S3_REGION` на Render)
3. Снять галочку «Block all public access» **не нужно** — загрузка идёт через presigned URL, бакет может оставаться приватным
4. Создать → затем вернуться к разделу 2 (CORS)

### 403 AccessDenied при PUT после настройки CORS

CORS пропускает preflight, но сам PUT отклонён. Причина — несовпадение заголовка `Content-Type`:
- Бэкенд подписывает presigned URL с конкретным `Content-Type` (см. `s3.service.ts`, `generatePresignedUploadUrl`)
- Фронтенд при PUT обязан отправить **точно такой же** `Content-Type` (например, `application/pdf`)
- Если фронтенд не шлёт `Content-Type` или шлёт другой — S3 вернёт `403 SignatureDoesNotMatch`

### CORS настроен, но фронтенд всё равно падает

Проверьте, какой storage реально использует бэкенд (раздел 1, «Проверьте имя бакета в Render»). Если настроен **Cloudflare R2** — CORS настраивается в панели Cloudflare (R2 → бакет → Settings → CORS Policy), а не в AWS. Инструкция: `docs/STAGING_SETUP_GUIDE.md` → Step 7 → Option A.

---

## Файлы проекта

| Файл | Назначение |
|:--|:--|
| `infrastructure/s3-cors-policy.json` | Готовая CORS-политика (для AWS CLI) |
| `scripts/apply-s3-cors.sh` | Скрипт применения через AWS CLI |
| `docs/STAGING_SETUP_GUIDE.md` | Step 7 — CORS для S3 **и** Cloudflare R2 |

---

> **Нужна помощь?** Пришлите Freebuff вывод команд из раздела 1 — по нему сразу видно, существует ли бакет и что именно нужно сделать.
