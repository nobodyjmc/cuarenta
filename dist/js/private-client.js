const ROOT = '/api/private';
const CREDENTIAL_KEY = 'cuarenta.private.seat.v1';
const ROOM_CODE = /^[2-9A-HJ-NP-Z]{10}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const ENDED = [401, 404, 410];

export class PrivateTableError extends Error {
  constructor(message, { code = 'CONNECTION_ERROR', status = 0 } = {}) {
    super(message);
    this.name = 'PrivateTableError';
    this.code = code;
    this.status = status;
  }
}

function defaultStorage() {
  try { return globalThis.sessionStorage; } catch { return null; }
}

function storedSeat(storage) {
  try {
    const seat = JSON.parse(storage?.getItem(CREDENTIAL_KEY) ?? 'null');
    if (ROOM_CODE.test(seat?.code) && TOKEN.test(seat?.token)) return seat;
  } catch { /* Storage may be unavailable in private browsing. */ }
  return null;
}

async function request(fetcher, timeout, path, { token, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetcher(ROOT + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    });
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new PrivateTableError('La mesa tardó demasiado en responder. Intenta nuevamente.');
    if (!response.ok) {
      throw new PrivateTableError(data?.error || 'La mesa no pudo responder a esta solicitud.', {
        code: data?.code || 'REQUEST_FAILED',
        status: response.status,
      });
    }
    if (!data) throw new PrivateTableError('La mesa envió una respuesta inválida.');
    return data;
  } catch (error) {
    if (error instanceof PrivateTableError) throw error;
    if (controller.signal.aborted) throw new PrivateTableError('La mesa tardó demasiado en responder. Intenta nuevamente.');
    throw new PrivateTableError('No se pudo conectar con la mesa. Revisa tu conexión.');
  } finally {
    clearTimeout(timer);
  }
}

function readRoom(data, code) {
  const room = data?.room;
  if (!room || !ROOM_CODE.test(room.code) || (code && room.code !== code) ||
      ![0, 1].includes(room.seat) || !Number.isSafeInteger(room.version) || room.version < 1 ||
      !Array.isArray(room.players) || room.players.length !== 2 ||
      !Array.isArray(room.rematch) || room.rematch.length !== 2) {
    throw new PrivateTableError('La mesa envió una respuesta inválida.');
  }
  return room;
}

export async function canUsePrivateTables({ fetcher = globalThis.fetch.bind(globalThis), timeout = 1500 } = {}) {
  const location = globalThis.location;
  if (location && (!['http:', 'https:'].includes(location.protocol) ||
      location.hostname.endsWith('.github.io'))) return false;
  try {
    return (await request(fetcher, timeout, '/status')).available === true;
  } catch {
    return false;
  }
}

export class PrivateTableClient {
  #fetcher;
  #storage;
  #onRoom;
  #onConnection;
  #pollInterval;
  #timeout;
  #credential;
  #room = null;
  #connection = 'disconnected';
  #active = false;
  #generation = 0;
  #timer;
  #command;

  constructor({
    onRoom = () => {},
    onConnection = () => {},
    storage = defaultStorage(),
    fetcher = globalThis.fetch.bind(globalThis),
    pollInterval = 850,
    timeout = 6000,
  } = {}) {
    this.#onRoom = onRoom;
    this.#onConnection = onConnection;
    this.#storage = storage;
    this.#fetcher = fetcher;
    this.#pollInterval = pollInterval;
    this.#timeout = timeout;
    this.#credential = storedSeat(storage);
  }

  get room() { return this.#room; }
  get credential() { return this.#credential && { ...this.#credential }; }
  get connection() { return this.#connection; }

  create({ name, comboPoints = 2 } = {}) {
    return this.#enter('/rooms', { name, comboPoints });
  }

  async join(input, { name } = {}) {
    const code = String(input ?? '').trim().toUpperCase();
    if (!ROOM_CODE.test(code)) {
      throw new PrivateTableError('Ingresa el código de 10 caracteres de la mesa.', { code: 'INVALID_CODE' });
    }
    if (this.#credential?.code === code) return this.restore();
    return this.#enter('/rooms/' + code + '/join', { name }, code);
  }

  async restore() {
    if (!this.#credential) return null;
    const command = this.#beginCommand();
    const generation = this.#resetPolling();
    this.#active = true;
    this.#setConnection('connecting');
    try {
      return await this.#read(generation, true);
    } catch (error) {
      this.#handleReadError(error, generation);
      throw error;
    } finally {
      this.#endCommand(command);
      this.#schedule(generation);
    }
  }

  play({ cardId, captureIds, expectedRevision, gameId }) {
    return this.#write('play', { cardId, captureIds, expectedRevision, gameId });
  }

  nextRound({ expectedRevision, gameId }) {
    return this.#write('next-round', { expectedRevision, gameId });
  }

  rematch({ gameId }) {
    return this.#write('rematch', { gameId });
  }

  disconnect() {
    this.#resetPolling();
    this.#command = null;
    this.#setConnection('disconnected');
  }

  forget() {
    this.#saveSeat(null);
    this.#room = null;
    this.disconnect();
  }

  #setConnection(status, error) {
    if (this.#connection === status) return;
    this.#connection = status;
    this.#onConnection(status, error);
  }

  #saveSeat(credential) {
    this.#credential = credential;
    try {
      if (credential) this.#storage?.setItem(CREDENTIAL_KEY, JSON.stringify(credential));
      else this.#storage?.removeItem(CREDENTIAL_KEY);
    } catch { /* The in-memory seat still works during this visit. */ }
  }

  #beginCommand() {
    if (this.#command) throw new PrivateTableError('Espera a que termine la solicitud anterior.', { code: 'BUSY' });
    this.#command = Symbol('private table command');
    return this.#command;
  }

  #endCommand(command) {
    if (this.#command === command) this.#command = null;
  }

  #resetPolling() {
    this.#active = false;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    return ++this.#generation;
  }

  #receive(room, notify = false) {
    const changed = this.#room?.code !== room.code || this.#room.seat !== room.seat ||
      room.version > this.#room.version;
    if (changed) this.#room = room;
    this.#setConnection('connected');
    if (changed || notify) this.#onRoom(this.#room);
    return this.#room;
  }

  async #enter(path, body, code) {
    const command = this.#beginCommand();
    const wasActive = this.#active;
    const generation = this.#resetPolling();
    this.#setConnection('connecting');
    try {
      const data = await request(this.#fetcher, this.#timeout, path, { body });
      if (generation !== this.#generation) return null;
      const room = readRoom(data, code);
      if (!TOKEN.test(data.token)) throw new PrivateTableError('No se pudo guardar el acceso a la mesa.');
      this.#saveSeat({ code: room.code, token: data.token });
      this.#room = null;
      this.#active = true;
      return this.#receive(room);
    } catch (error) {
      if (generation === this.#generation) {
        this.#active = wasActive;
        this.#setConnection(wasActive ? 'reconnecting' : 'disconnected', error);
      }
      throw error;
    } finally {
      this.#endCommand(command);
      this.#schedule(generation);
    }
  }

  async #read(generation, notify = false) {
    const { code, token } = this.#credential;
    const data = await request(this.#fetcher, this.#timeout, '/rooms/' + code, { token });
    if (generation !== this.#generation) return null;
    return this.#receive(readRoom(data, code), notify);
  }

  #handleReadError(error, generation) {
    if (generation !== this.#generation) return;
    if (ENDED.includes(error.status)) {
      this.#resetPolling();
      this.#saveSeat(null);
      this.#room = null;
      this.#setConnection('expired', error);
      return;
    }
    this.#setConnection('reconnecting', error);
  }

  #schedule(generation) {
    if (!this.#active || generation !== this.#generation || this.#timer !== undefined) return;
    const delay = this.#connection === 'reconnecting' ? this.#pollInterval * 3 : this.#pollInterval;
    this.#timer = setTimeout(async () => {
      this.#timer = undefined;
      try {
        await this.#read(generation);
      } catch (error) {
        this.#handleReadError(error, generation);
      } finally {
        this.#schedule(generation);
      }
    }, delay);
  }

  async #write(action, body) {
    if (!this.#active || !this.#credential) {
      throw new PrivateTableError('Vuelve a conectarte a la mesa antes de jugar.', { code: 'NOT_CONNECTED' });
    }
    const command = this.#beginCommand();
    // Ignore any poll already in flight while this command is being resolved.
    const generation = this.#resetPolling();
    this.#active = true;
    const { code, token } = this.#credential;
    try {
      const data = await request(this.#fetcher, this.#timeout, '/rooms/' + code + '/' + action, { token, body });
      if (generation !== this.#generation) return null;
      return this.#receive(readRoom(data, code));
    } catch (error) {
      if (generation === this.#generation) {
        if (ENDED.includes(error.status)) this.#handleReadError(error, generation);
        else if ([0, 409].includes(error.status)) {
          // A lost response may arrive after the host already accepted the move.
          try { await this.#read(generation); }
          catch (readError) { this.#handleReadError(readError, generation); }
        }
      }
      throw error;
    } finally {
      this.#endCommand(command);
      this.#schedule(generation);
    }
  }
}
