require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Configurar conexão PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

// Testar conexão
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erro ao conectar no PostgreSQL:', err);
  } else {
    console.log('✅ Conectado ao PostgreSQL:', res.rows[0].now);
    initDB();
  }
});

// Criar tabelas
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dt_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dt_operacoes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        data DATE NOT NULL,
        ativo VARCHAR(20) NOT NULL,
        tipo VARCHAR(10) NOT NULL,
        quantidade INTEGER NOT NULL,
        preco_entrada DECIMAL(10,2) NOT NULL,
        preco_saida DECIMAL(10,2) NOT NULL,
        stop_loss DECIMAL(10,2),
        resultado_bruto DECIMAL(10,2),
        corretagem DECIMAL(10,2),
        emolumentos DECIMAL(10,2),
        taxa_liquidacao DECIMAL(10,2),
        custo_total DECIMAL(10,2),
        imposto DECIMAL(10,2),
        resultado_final DECIMAL(10,2),
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES dt_users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dt_configuracoes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        capital_total DECIMAL(10,2),
        risco_por_operacao DECIMAL(5,2),
        meta_diaria DECIMAL(10,2),
        perda_maxima_diaria DECIMAL(10,2),
        corretagem_padrao DECIMAL(10,2),
        emolumentos_padrao DECIMAL(5,4),
        taxa_liquidacao_padrao DECIMAL(5,4),
        FOREIGN KEY (user_id) REFERENCES dt_users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dt_diarios (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        data DATE NOT NULL,
        humor VARCHAR(20),
        disciplina INTEGER,
        acertos TEXT,
        erros TEXT,
        aprendizados TEXT,
        observacoes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES dt_users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dt_custos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        data DATE NOT NULL,
        corretagem DECIMAL(10,2) DEFAULT 0,
        emolumentos DECIMAL(10,2) DEFAULT 0,
        registro DECIMAL(10,2) DEFAULT 0,
        irrf DECIMAL(10,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        descricao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES dt_users(id) ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_dt_operacoes_user_id ON dt_operacoes(user_id);
      CREATE INDEX IF NOT EXISTS idx_dt_operacoes_data ON dt_operacoes(data);
      CREATE INDEX IF NOT EXISTS idx_dt_diarios_user_id ON dt_diarios(user_id);
    `);

    console.log('✅ Tabelas Day Trade criadas/verificadas');
  } catch (err) {
    console.error('❌ Erro ao criar tabelas:', err);
  }
}

// ============= ROTAS DE USUÁRIO =============

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT id, username FROM dt_users WHERE username = $1 AND password = $2',
      [username, password]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e password são obrigatórios' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Senha deve ter no mínimo 4 caracteres' });
  }
  
  try {
    const result = await pool.query(
      'INSERT INTO dt_users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, password]
    );
    
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Usuário já existe' });
    }
    console.error('Erro no registro:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE OPERAÇÕES =============

app.get('/api/operacoes/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM dt_operacoes WHERE user_id = $1 ORDER BY data DESC, created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar operações:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/operacoes', async (req, res) => {
  const op = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO dt_operacoes (
        user_id, data, ativo, tipo, quantidade, preco_entrada, preco_saida,
        stop_loss, resultado_bruto, corretagem, emolumentos, taxa_liquidacao,
        custo_total, imposto, resultado_final, observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [
      op.user_id, op.data, op.ativo, op.tipo, op.quantidade, 
      op.preco_entrada, op.preco_saida, op.stop_loss, op.resultado_bruto,
      op.corretagem, op.emolumentos, op.taxa_liquidacao, op.custo_total,
      op.imposto, op.resultado_final, op.observacoes
    ]);
    
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao criar operação:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/operacoes/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query('DELETE FROM dt_operacoes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar operação:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE CONFIGURAÇÃO =============

app.get('/api/configuracao/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM dt_configuracoes WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Erro ao buscar configuração:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/configuracao', async (req, res) => {
  const config = req.body;
  
  try {
    await pool.query(`
      INSERT INTO dt_configuracoes (
        user_id, capital_total, risco_por_operacao, meta_diaria,
        perda_maxima_diaria, corretagem_padrao, emolumentos_padrao,
        taxa_liquidacao_padrao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        capital_total = $2,
        risco_por_operacao = $3,
        meta_diaria = $4,
        perda_maxima_diaria = $5,
        corretagem_padrao = $6,
        emolumentos_padrao = $7,
        taxa_liquidacao_padrao = $8
    `, [
      config.user_id, config.capital_total, config.risco_por_operacao,
      config.meta_diaria, config.perda_maxima_diaria, config.corretagem_padrao,
      config.emolumentos_padrao, config.taxa_liquidacao_padrao
    ]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao salvar configuração:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE DIÁRIO =============

app.get('/api/diarios/:userId', async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      'SELECT * FROM dt_diarios WHERE user_id = $1 ORDER BY data DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar diários:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diarios', async (req, res) => {
  const d = req.body;
  
  try {
    const result = await pool.query(`
      INSERT INTO dt_diarios (
        user_id, data, humor, disciplina, acertos, erros, aprendizados, observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      d.user_id, d.data, d.humor, d.disciplina, 
      d.acertos, d.erros, d.aprendizados, d.observacoes
    ]);
    
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao criar diário:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/diarios/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM dt_diarios WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar diário:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= ROTAS DE CUSTOS =============

app.get('/api/custos/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM dt_custos WHERE user_id = $1 ORDER BY data DESC, created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar custos:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/custos', async (req, res) => {
  const c = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO dt_custos (
        user_id, data, corretagem, emolumentos, registro, irrf, total, descricao
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      c.user_id, c.data, c.corretagem || 0, c.emolumentos || 0,
      c.registro || 0, c.irrf || 0, c.total, c.descricao
    ]);

    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao criar custo:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/custos/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query('DELETE FROM dt_custos WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar custo:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============= HEALTH CHECK =============

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    database: 'connected'
  });
});

app.get('/', (req, res) => {
  res.json({
    message: '🚀 Day Trade API está rodando!',
    endpoints: {
      auth: ['/api/login', '/api/register'],
      operacoes: ['/api/operacoes/:userId', '/api/operacoes (POST/DELETE)'],
      configuracao: ['/api/configuracao/:userId', '/api/configuracao (POST)'],
      diarios: ['/api/diarios/:userId', '/api/diarios (POST/DELETE)'],
      custos: ['/api/custos/:userId', '/api/custos (POST/DELETE)'],
      health: '/health'
    }
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor Day Trade rodando em http://0.0.0.0:${PORT}`);
  console.log(`📊 Banco: ${process.env.DB_NAME || 'apps'}`);
  console.log(`🔗 Host: ${process.env.DB_HOST || 'apps_postgres'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  await pool.end();
  console.log('🔌 Pool PostgreSQL fechado');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM recebido...');
  await pool.end();
  process.exit(0);
});
