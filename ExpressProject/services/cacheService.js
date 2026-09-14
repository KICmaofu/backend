const NodeCache = require('node-cache');
const crypto = require('crypto');
const winston = require('../config/logger');
// Cache Service
class CacheService {
  constructor() {
    const cacheEnabled = process.env.CACHE_ENABLED !== 'false';
    const cacheTTL = parseInt(process.env.CACHE_TTL) || 3600;
    const cacheMaxSize = parseInt(process.env.CACHE_MAX_SIZE) || 5000;
    
    if (cacheEnabled) {
      this.cache = new NodeCache({
        stdTTL: cacheTTL,
        checkperiod: cacheTTL / 2,
        maxKeys: cacheMaxSize,
        useClones: false
      });
      winston.info('Cache service initialized');
    } else {
      this.cache = null;
      winston.info('Cache service disabled');
    }
  }

  generateKey(prefix, data) {
    const keyData = typeof data === 'string' ? data : JSON.stringify(data);
    return `${prefix}:${crypto.createHash('md5').update(keyData).digest('hex')}`;
  }

  generateApiKey(path, query = {}, params = {}) {
    const data = {
      path,
      query,
      params
    };
    return this.generateKey('api', data);
  }

  get(key) {
    if (!this.cache) return null;

    try {
      const cached = this.cache.get(key);
      
      if (cached) {
        winston.debug(`Cache hit for key: ${key}`);
        return cached;
      }
      
      winston.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      winston.error('Cache get error:', error);
      return null;
    }
  }

  set(key, value, ttl = null) {
    if (!this.cache) return false;

    try {
      const cacheTTL = ttl || parseInt(process.env.CACHE_TTL) || 3600;
      this.cache.set(key, value, cacheTTL);
      winston.debug(`Cached value for key: ${key}`);
      return true;
    } catch (error) {
      winston.error('Cache set error:', error);
      return false;
    }
  }

  delete(key) {
    if (!this.cache) return false;

    try {
      return this.cache.del(key) > 0;
    } catch (error) {
      winston.error('Cache delete error:', error);
      return false;
    }
  }

  deleteByPrefix(prefix) {
    if (!this.cache) return false;

    try {
      const keys = this.cache.keys();
      const keysToDelete = keys.filter(key => key.startsWith(prefix));
      if (keysToDelete.length > 0) {
        this.cache.del(keysToDelete);
        winston.info(`Deleted ${keysToDelete.length} cache entries with prefix: ${prefix}`);
        return true;
      }
      return false;
    } catch (error) {
      winston.error('Cache delete by prefix error:', error);
      return false;
    }
  }

  clear() {
    if (!this.cache) return false;

    try {
      this.cache.flushAll();
      winston.info('Cache cleared');
      return true;
    } catch (error) {
      winston.error('Cache clear error:', error);
      return false;
    }
  }

  getStats() {
    if (!this.cache) {
      return { enabled: false };
    }

    try {
      const stats = this.cache.getStats();
      return {
        enabled: true,
        keys: stats.keys,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hits / (stats.hits + stats.misses) || 0,
        ksize: stats.ksize,
        vsize: stats.vsize
      };
    } catch (error) {
      winston.error('Cache stats error:', error);
      return { enabled: true, error: error.message };
    }
  }
}

module.exports = new CacheService();