/**
 * Popula o backend srv-lutheria (perfil dev) com os dados de demonstração do front, usando só a
 * API pública. Pensado para teste e2e local: rode com o backend no ar e depois `npm run dev:api`.
 *
 *   npm run seed:api                         # API em http://localhost:8080
 *   API_URL=http://localhost:9090 npm run seed:api
 *
 * Idempotente: se a oficina já existe, entra com o dono e só cria o que falta.
 * As credenciais são as mesmas dos botões "Contas de Teste" da tela de login.
 */
import {
  INITIAL_CLIENTS,
  INITIAL_INSTRUMENTS,
  INITIAL_ORDERS,
  INITIAL_STOCK,
} from '../src/data/seedData';

const API_URL = (process.env.API_URL || 'http://localhost:8080').replace(/\/+$/, '');

const OWNER = {
  name: 'Armando Luthier',
  email: 'armando.luthier@oficina.com',
  password: 'Luthier@2026',
  // Mesmo CPF da conta demo (server.ts): permite testar o login por CPF
  cpf: '123.456.789-09',
};
const ATTENDANT = { name: 'Mariana Balcão', email: 'mariana.balcao@oficina.com', password: 'Balcao@2026!' };

let accessToken = '';

async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : undefined) as T };
}

async function must<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { status, data } = await call<T>(method, path, body);
  if (status >= 400) {
    throw new Error(`${method} ${path} → ${status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`Seed em ${API_URL}`);

  // 1. Oficina + dono (ADMIN)
  const reg = await call<{ accessToken: string }>('POST', '/auth/register', {
    workshop: { name: 'Oficina do Armando' },
    owner: { ...OWNER, phone: '(11) 98765-4321' },
  });
  if (reg.status === 201) {
    accessToken = reg.data.accessToken;
    console.log(`✔ Oficina criada, dono ${OWNER.email}`);
  } else {
    accessToken = (
      await must<{ accessToken: string }>('POST', '/auth/login', {
        identifier: OWNER.email,
        password: OWNER.password,
      })
    ).accessToken;
    console.log(`• Oficina já existia, entrando como ${OWNER.email}`);
  }

  // 2. Atendente
  const users = await must<{ email: string }[]>('GET', '/users');
  if (!users.some((u) => u.email === ATTENDANT.email)) {
    await must('POST', '/users', { ...ATTENDANT, profile: 'ATENDENTE' });
    console.log(`✔ Atendente ${ATTENDANT.email}`);
  }

  // 3. Estoque
  const products = await must<{ content: { id: string; sku: string }[] }>(
    'GET',
    '/products?size=100'
  );
  const productIdBySeedId = new Map<string, string>();
  for (const item of INITIAL_STOCK) {
    const existing = products.content.find((p) => p.sku === item.sku);
    const id =
      existing?.id ??
      (
        await must<{ id: string }>('POST', '/products', {
          name: item.name,
          category: item.category,
          brand: item.brand,
          sku: item.sku,
          barcode: item.barcode,
          unit: item.unit,
          costPrice: item.costPrice,
          salePrice: item.salePrice,
          minQuantity: item.minQuantity,
          initialQuantity: item.currentQuantity,
          location: item.location,
        })
      ).id;
    productIdBySeedId.set(item.id, id);
  }
  console.log(`✔ ${INITIAL_STOCK.length} itens de estoque`);

  // 4. Clientes, instrumentos e OS (só numa oficina vazia, para não duplicar)
  const customers = await must<{ totalElements: number }>('GET', '/customers?size=1');
  if (customers.totalElements > 0) {
    console.log('• Clientes já cadastrados: pulando clientes, instrumentos e OS');
  } else {
    const customerIdBySeedId = new Map<string, string>();
    const instrumentIdBySeedId = new Map<string, string>();
    for (const c of INITIAL_CLIENTS) {
      // CPFs da demonstração não são válidos: o backend valida dígitos, então ficam de fora
      const created = await must<{ id: string }>('POST', '/customers', {
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
      });
      customerIdBySeedId.set(c.id, created.id);
    }
    for (const i of INITIAL_INSTRUMENTS) {
      const customerId = customerIdBySeedId.get(i.clientId);
      if (!customerId) continue;
      const created = await must<{ id: string }>('POST', `/customers/${customerId}/instruments`, {
        type: i.type,
        brand: i.brand,
        model: i.model,
        serialNumber: i.serialNumber,
        year: i.year,
        finishColor: i.finishColor,
        stringsGauge: i.stringsGauge,
        tuningPreference: i.tuningPreference,
        actionHeight12thFret: i.actionHeight12thFret,
        conditionNotes: i.conditionNotes,
      });
      instrumentIdBySeedId.set(i.id, created.id);
    }
    console.log(`✔ ${INITIAL_CLIENTS.length} clientes e ${instrumentIdBySeedId.size} instrumentos`);

    let orders = 0;
    for (const o of INITIAL_ORDERS) {
      const customerId = customerIdBySeedId.get(o.clientId);
      const instrumentId = instrumentIdBySeedId.get(o.instrumentId);
      if (!customerId || !instrumentId) continue;
      const created = await must<{ id: string }>('POST', '/service-orders', {
        customerId,
        instrumentId,
        priority: o.priority,
        reportedIssue: o.reportedIssue,
        services: o.services.map((s) => ({ title: s.title, description: s.description, laborPrice: s.laborPrice })),
      });
      for (const part of o.services.flatMap((s) => s.partsUsed)) {
        const productId = productIdBySeedId.get(part.stockItemId);
        if (productId) await call('POST', `/service-orders/${created.id}/parts`, { productId, quantity: part.quantity });
      }
      orders++;
    }
    console.log(`✔ ${orders} ordens de serviço (status "recebido")`);
  }

  console.log('\nPronto! Contas para o login do front:');
  console.log(`  Luthier/Dono: ${OWNER.email} (ou CPF ${OWNER.cpf}) / ${OWNER.password}`);
  console.log(`  Atendente:    ${ATTENDANT.email} / ${ATTENDANT.password}`);
}

main().catch((err) => {
  console.error(`✖ Seed falhou: ${err.message}`);
  if (String(err.message).includes('fetch failed')) {
    console.error(`  O backend está rodando em ${API_URL}?`);
  }
  process.exit(1);
});
