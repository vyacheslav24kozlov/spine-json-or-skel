# spine-json-or-skel

Benchmark для сравнения производительности Spine-анимаций в форматах **JSON** и **SKEL** (binary).

Используется ассет `assets/animation_minor` (Spine 4.2.43) и runtime `@esotericsoftware/spine-core` / `spine-webgl` 4.2.43.

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
