export function createSalonChangeCoalescer(
  onFlush: (tables: string[]) => void,
  delayMs = 80,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tables = new Set<string>();

  return {
    push(table: string) {
      tables.add(table);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        const batch = [...tables];
        tables.clear();
        onFlush(batch);
      }, delayMs);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      tables.clear();
    },
  };
}
