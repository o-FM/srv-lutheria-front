import { defineConfig } from 'vitest/config';

// Testes de regras puras (utils e domínio). Componentes React ficam para depois.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
