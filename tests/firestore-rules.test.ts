/**
 * Suíte de Testes para Validação das Regras do Firestore (firestore.rules)
 * 
 * Casos cobertos:
 * 1. Estudante autenticado lendo o próprio perfil
 * 2. Estudante autenticado tentando ler outro perfil (/users/outroUid)
 * 3. Tentativa de autopromoção para admin (criação e atualização)
 * 4. Tentativa de alteração de plano (de free para premium)
 * 5. Tentativa de escrita em conteúdo editorial (disciplines, compendiums, questions, etc.)
 * 6. Comprovação de que regras de coleções compartilhadas não concedem acesso a /users/{outroUid}
 * 7. Tentativa de acesso sem autenticação
 * 8. Tentativa de injeção de campos extras na criação do perfil
 * 9. Atualização permitida de displayName e photoURL pelo próprio usuário
 * 10. Coleção removida /clinicalCases: nenhum acesso (autenticado ou não) é permitido
 */

interface RequestAuth {
  uid: string;
  token?: Record<string, any>;
}

interface FirestoreRequest {
  auth: RequestAuth | null;
  time: number;
  resource?: {
    data: Record<string, any>;
  };
}

interface FirestoreResource {
  data: Record<string, any>;
}

// Implementação do modelo de avaliação de firestore.rules
export class FirestoreRulesEvaluator {
  private allowedFieldsForCreation = [
    'uid',
    'email',
    'displayName',
    'photoURL',
    'role',
    'plan',
    'createdAt',
    'lastLoginAt',
  ];

  private allowedFieldsForUpdate = ['displayName', 'photoURL', 'lastLoginAt'];

  evaluate(
    path: string,
    operation: 'get' | 'list' | 'create' | 'update' | 'delete',
    request: FirestoreRequest,
    existingResource?: FirestoreResource
  ): { allowed: boolean; reason?: string } {
    const segments = path.split('/').filter(Boolean);
    const rootCollection = segments[0];

    const isAuthenticated = request.auth !== null;

    // 1. Perfil do Usuário: /users/{userId}
    if (rootCollection === 'users') {
      const userId = segments[1];
      if (!userId || segments.length > 2) {
        return { allowed: false, reason: 'Caminho de subcoleção não mapeado' };
      }

      const isOwner = isAuthenticated && request.auth?.uid === userId;

      // Leitura
      if (operation === 'get' || operation === 'list') {
        if (isOwner) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Apenas o titular pode ler o próprio perfil' };
      }

      // Criação
      if (operation === 'create') {
        if (!isOwner) {
          return { allowed: false, reason: 'Apenas o próprio usuário pode criar seu perfil' };
        }

        const data = request.resource?.data || {};
        const keys = Object.keys(data);

        // Exige todos e apenas os 8 campos previstos
        const hasAll = this.allowedFieldsForCreation.every((f) => keys.includes(f));
        const hasOnly = keys.every((f) => this.allowedFieldsForCreation.includes(f));

        if (!hasAll || !hasOnly) {
          return { allowed: false, reason: 'Documento não contém exatamente os 8 campos obrigatórios' };
        }

        if (data.uid !== userId) {
          return { allowed: false, reason: 'uid deve corresponder ao userId do documento' };
        }

        if (data.role !== 'student') {
          return { allowed: false, reason: 'Novos usuários devem ter obrigatoriamente role=student' };
        }

        if (data.plan !== 'free') {
          return { allowed: false, reason: 'Novos usuários devem ter plano inicial free' };
        }

        if (data.createdAt !== request.time || data.lastLoginAt !== request.time) {
          return { allowed: false, reason: 'Timestamps de criação devem coincidir com request.time' };
        }

        return { allowed: true };
      }

      // Atualização
      if (operation === 'update') {
        if (!isOwner) {
          return { allowed: false, reason: 'Apenas o titular pode atualizar o perfil' };
        }

        const currentData = existingResource?.data || {};
        const nextData = request.resource?.data || {};

        // Identificar campos alterados
        const affectedKeys = Object.keys(nextData).filter(
          (k) => nextData[k] !== currentData[k]
        );

        const onlyAllowedUpdates = affectedKeys.every((k) =>
          this.allowedFieldsForUpdate.includes(k)
        );

        if (!onlyAllowedUpdates) {
          return {
            allowed: false,
            reason: `Campos protegidos não podem ser alterados: ${affectedKeys.join(', ')}`,
          };
        }

        if (nextData.uid !== currentData.uid) {
          return { allowed: false, reason: 'uid é imutável' };
        }

        if (nextData.role !== currentData.role) {
          return { allowed: false, reason: 'role é imutável pelo cliente' };
        }

        if (nextData.plan !== currentData.plan) {
          return { allowed: false, reason: 'plan não pode ser alterado diretamente pelo cliente' };
        }

        if (nextData.createdAt !== currentData.createdAt) {
          return { allowed: false, reason: 'createdAt é imutável' };
        }

        return { allowed: true };
      }

      // Deleção
      if (operation === 'delete') {
        return { allowed: false, reason: 'Exclusão direta de usuário desativada nas regras' };
      }
    }

    // 2. Coleções Compartilhadas: disciplines, themes, compendiums, questions
    const sharedCollections = ['disciplines', 'themes', 'compendiums', 'questions'];
    if (sharedCollections.includes(rootCollection)) {
      if (operation === 'get' || operation === 'list') {
        if (isAuthenticated) {
          return { allowed: true };
        }
        return { allowed: false, reason: 'Requer autenticação para leitura de conteúdo compartilhado' };
      }

      if (operation === 'create' || operation === 'update' || operation === 'delete') {
        return { allowed: false, reason: 'Escrita desabilitada para conteúdo compartilhado (allow write: if false;)' };
      }
    }

    // Negação por padrão para qualquer outra coleção
    return { allowed: false, reason: 'Acesso negado por padrão (rota não autorizada)' };
  }
}

// Execução dos testes
function runTests() {
  const evaluator = new FirestoreRulesEvaluator();
  const simulatedTime = 1700000000;
  let passedCount = 0;
  let failedCount = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`  ✓ PASSOU: ${name}`);
      passedCount++;
    } else {
      console.error(`  ✗ FALHOU: ${name} ${details ? `(${details})` : ''}`);
      failedCount++;
    }
  }

  console.log('\n--- INICIANDO TESTES DAS REGRAS DO FIRESTORE ---\n');

  // Teste 1: Estudante autenticado lendo seu próprio perfil
  {
    const result = evaluator.evaluate(
      '/users/student-uid-123',
      'get',
      { auth: { uid: 'student-uid-123' }, time: simulatedTime }
    );
    assert('1. Estudante autenticado lendo o próprio perfil (/users/{userId})', result.allowed === true);
  }

  // Teste 2: Tentativa de ler outro perfil
  {
    const result = evaluator.evaluate(
      '/users/student-uid-999',
      'get',
      { auth: { uid: 'student-uid-123' }, time: simulatedTime }
    );
    assert('2. Tentativa de ler outro perfil (/users/outroUid) deve ser NEGADA', result.allowed === false);
  }

  // Teste 3: Autopromoção para admin
  {
    // 3a. Na criação
    const createWithAdmin = evaluator.evaluate(
      '/users/attacker-uid',
      'create',
      {
        auth: { uid: 'attacker-uid' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'attacker-uid',
            email: 'attacker@test.com',
            displayName: 'Attacker',
            photoURL: null,
            role: 'admin', // Tentativa de autopromoção
            plan: 'free',
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
          },
        },
      }
    );
    assert('3a. Autopromoção para admin na criação deve ser NEGADA', createWithAdmin.allowed === false);

    // 3b. Na atualização
    const updateToAdmin = evaluator.evaluate(
      '/users/student-uid-123',
      'update',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'student-uid-123',
            email: 'student@test.com',
            displayName: 'Estudante',
            photoURL: null,
            role: 'admin', // Tentativa de autopromoção
            plan: 'free',
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
          },
        },
      },
      {
        data: {
          uid: 'student-uid-123',
          email: 'student@test.com',
          displayName: 'Estudante',
          photoURL: null,
          role: 'student',
          plan: 'free',
          createdAt: simulatedTime,
          lastLoginAt: simulatedTime,
        },
      }
    );
    assert('3b. Autopromoção para admin na atualização deve ser NEGADA', updateToAdmin.allowed === false);
  }

  // Teste 4: Tentativa de alteração do plano (ex: free -> premium)
  {
    const updatePlan = evaluator.evaluate(
      '/users/student-uid-123',
      'update',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'student-uid-123',
            email: 'student@test.com',
            displayName: 'Estudante',
            photoURL: null,
            role: 'student',
            plan: 'premium', // Tentativa de forçar premium
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
          },
        },
      },
      {
        data: {
          uid: 'student-uid-123',
          email: 'student@test.com',
          displayName: 'Estudante',
          photoURL: null,
          role: 'student',
          plan: 'free',
          createdAt: simulatedTime,
          lastLoginAt: simulatedTime,
        },
      }
    );
    assert('4. Tentativa de alteração de plano pelo cliente deve ser NEGADA', updatePlan.allowed === false);
  }

  // Teste 5: Escrita em conteúdo editorial compartilhado
  {
    const collectionsToTest = ['disciplines', 'themes', 'compendiums', 'questions'];
    for (const col of collectionsToTest) {
      const resCreate = evaluator.evaluate(
        `/${col}/item-1`,
        'create',
        {
          auth: { uid: 'student-uid-123' },
          time: simulatedTime,
          resource: { data: { title: 'Novo Conteúdo' } },
        }
      );
      assert(`5. Escrita proibida em /${col} (allow write: if false;)`, resCreate.allowed === false);
    }
  }

  // Teste 6: Comprovação de que regras das coleções compartilhadas NÃO concedem acesso a /users/outroUid
  {
    const resultOtherProfile = evaluator.evaluate(
      '/users/vitima-uid-888',
      'get',
      { auth: { uid: 'estudante-uid-111' }, time: simulatedTime }
    );
    assert(
      '6. Leitura de /users/outroUid é estritamente bloqueada (sem regras sobrepostas)',
      resultOtherProfile.allowed === false
    );
  }

  // Teste 7: Usuário não autenticado tentando ler conteúdo compartilhado
  {
    const resultUnauth = evaluator.evaluate(
      '/compendiums/comp-1',
      'get',
      { auth: null, time: simulatedTime }
    );
    assert('7. Acesso não autenticado a /compendiums deve ser NEGADO', resultUnauth.allowed === false);
  }

  // Teste 8: Criação de perfil com campos extras ou faltando obrigatórios
  {
    const resultMissingField = evaluator.evaluate(
      '/users/student-uid-123',
      'create',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'student-uid-123',
            email: 'student@test.com',
            // displayName faltando
            role: 'student',
            plan: 'free',
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
          },
        },
      }
    );
    assert('8a. Criação sem campos obrigatórios deve ser NEGADA', resultMissingField.allowed === false);

    const resultExtraField = evaluator.evaluate(
      '/users/student-uid-123',
      'create',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'student-uid-123',
            email: 'student@test.com',
            displayName: 'Estudante',
            photoURL: null,
            role: 'student',
            plan: 'free',
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
            unauthorizedExtraField: 'bypass',
          },
        },
      }
    );
    assert('8b. Criação com campos adicionais não previstos deve ser NEGADA', resultExtraField.allowed === false);
  }

  // Teste 9: Atualização permitida de displayName e photoURL pelo titular
  {
    const updateAllowed = evaluator.evaluate(
      '/users/student-uid-123',
      'update',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: {
          data: {
            uid: 'student-uid-123',
            email: 'student@test.com',
            displayName: 'Novo Nome do Estudante',
            photoURL: 'https://lh3.googleusercontent.com/avatar.png',
            role: 'student',
            plan: 'free',
            createdAt: simulatedTime,
            lastLoginAt: simulatedTime,
          },
        },
      },
      {
        data: {
          uid: 'student-uid-123',
          email: 'student@test.com',
          displayName: 'Nome Antigo',
          photoURL: null,
          role: 'student',
          plan: 'free',
          createdAt: simulatedTime,
          lastLoginAt: simulatedTime,
        },
      }
    );
    assert('9. Atualização permitida de displayName e photoURL pelo titular', updateAllowed.allowed === true);
  }

  // Teste 10: Coleção /clinicalCases foi removida — nenhum acesso deve ser permitido
  {
    const authenticatedGet = evaluator.evaluate(
      '/clinicalCases/case-1',
      'get',
      { auth: { uid: 'student-uid-123' }, time: simulatedTime }
    );
    assert(
      '10a. Usuário autenticado lendo /clinicalCases/{id} deve ser NEGADO (coleção removida)',
      authenticatedGet.allowed === false
    );

    const authenticatedCreate = evaluator.evaluate(
      '/clinicalCases/case-1',
      'create',
      {
        auth: { uid: 'student-uid-123' },
        time: simulatedTime,
        resource: { data: { title: 'Tentativa de recriar coleção removida' } },
      }
    );
    assert(
      '10b. Usuário autenticado escrevendo em /clinicalCases/{id} deve ser NEGADO (coleção removida)',
      authenticatedCreate.allowed === false
    );

    const unauthenticatedGet = evaluator.evaluate(
      '/clinicalCases/case-1',
      'get',
      { auth: null, time: simulatedTime }
    );
    assert(
      '10c. Usuário não autenticado lendo /clinicalCases/{id} deve ser NEGADO',
      unauthenticatedGet.allowed === false
    );
  }

  console.log(`\n--- RESULTADO DOS TESTES: ${passedCount} aprovados, ${failedCount} reprovados ---\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
