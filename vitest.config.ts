import { defineConfig } from 'vitest/config';

// Testes de regras puras (utils e domínio). Componentes React ficam para depois.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Fuso fixo: os testes de data reproduzem o caso real (Brasília, UTC-3).
    env: { TZ: 'America/Sao_Paulo' },
  },
});
