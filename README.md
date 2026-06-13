# spine-json-or-skel

Benchmark для сравнения производительности Spine-анимаций в форматах **JSON** и **SKEL** (binary).

## Версии Spine

Ассеты в `assets/` экспортированы из **Spine Editor 4.2.43** (`animation_minor.json`, `animation_minor.skel`).

Runtime в `package.json` должен совпадать с версией ассетов:

| Пакет | Версия |
|-------|--------|
| `@esotericsoftware/spine-core` | `4.2.43` |
| `@esotericsoftware/spine-webgl` | `4.2.43` |

Не обновляйте runtime на 4.3.x и новее без переэкспорта ассетов. Бинарный формат `.skel` меняется между мажорными версиями Spine: при несовпадении версий парсинг SKEL падает (например, `Bone name must not be null`). JSON может загрузиться, но поведение всё равно не гарантировано.

Если нужен runtime 4.3+, переэкспортируйте skeleton из Spine Editor той же версии и обновите зависимости.

## Что измеряется

1. **Парсинг** — загрузка и разбор 100 копий skeleton data:
   - общее и среднее время;
   - min / max на одну копию;
   - оценка просадок кадров (блокировка main thread > 16.67 ms при 60 FPS).

2. **Playback** — одновременное воспроизведение 100 анимаций в WebGL:
   - средний и минимальный FPS;
   - количество просадок;
   - P95 frame time.

## Быстрый старт

```bash
npm install
```

### CLI benchmark (только парсинг, Node.js)

```bash
npm run benchmark:parse
```

Переменная окружения `INSTANCES` задаёт число копий (по умолчанию 100):

```bash
INSTANCES=200 npm run benchmark:parse
```

### Веб-benchmark (парсинг + playback + визуализация)

```bash
npm run dev
```

Откройте http://localhost:5173 и нажмите **«Запустить benchmark»**.

## Структура

```
assets/                 # Spine-ассеты
src/
  main.ts               # веб-интерфейс benchmark
  parse-cli.ts          # CLI для парсинга
  shared/
    parseBenchmark.ts   # логика замера парсинга
    playbackBenchmark.ts
    spineLoader.ts
    metrics.ts
```

## Пример результатов (Node.js, 100 копий)

| Метрика | JSON | SKEL |
|---------|------|------|
| Размер файла | ~21 KB | ~9.5 KB |
| Парсинг 100 копий | ~66 ms | ~21 ms |
| Ускорение SKEL | — | ~3x |

Результаты зависят от CPU и браузера. Для финального сравнения запускайте оба формата в одной среде.
