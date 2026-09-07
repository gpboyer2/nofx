import { api } from '../api'
import type { AIModel, Exchange } from '../../types'

export function modelHasCredential(model: AIModel) {
  return Boolean(
    model.has_api_key ||
    model.apiKey ||
    (model.provider === 'claw402' && model.walletAddress)
  )
}

export function exchangeHasKey(exchange: Exchange) {
  return Boolean(exchange.has_api_key || exchange.apiKey)
}

export function isHyperliquidExchange(exchange: Exchange) {
  return exchange.exchange_type === 'hyperliquid'
}

/** Prefers the claw402 model, falls back to any enabled model with a credential. */
export function pickTradingModel(models: AIModel[]) {
  return (
    models.find(
      (model) =>
        model.provider === 'claw402' &&
        model.enabled &&
        modelHasCredential(model)
    ) ||
    models.find((model) => model.enabled && modelHasCredential(model)) ||
    null
  )
}

export function pickTradingExchange(exchanges: Exchange[]) {
  return (
    exchanges.find(
      (exchange) =>
        isHyperliquidExchange(exchange) &&
        exchange.enabled &&
        exchangeHasKey(exchange) &&
        Boolean(exchange.hyperliquidBuilderApproved) &&
        (exchange.hyperliquidWalletAddr || '').trim() !== ''
    ) || null
  )
}

/**
 * Resolves a launch-capable AI model, auto-provisioning the beginner claw402
 * wallet when none is configured yet. Returns null when nothing could be
 * resolved — the caller routes the user into claw402 setup.
 */
export async function resolveLaunchModel(): Promise<AIModel | null> {
  let models = await api.getModelConfigs()
  let model = pickTradingModel(models)
  if (model) return model

  const onboarding = await api.prepareBeginnerOnboarding()
  models = await api.getModelConfigs()
  model =
    models.find(
      (item) =>
        item.id === onboarding.configured_model_id &&
        item.enabled &&
        modelHasCredential(item)
    ) || pickTradingModel(models)
  if (model) return model

  if (onboarding.configured_model_id && onboarding.private_key) {
    await api.updateModelConfigs({
      models: {
        [onboarding.configured_model_id]: {
          enabled: true,
          api_key: onboarding.private_key,
          custom_api_url: '',
          custom_model_name: onboarding.default_model,
        },
      },
    })
    models = await api.getModelConfigs()
    model =
      models.find(
        (item) =>
          item.id === onboarding.configured_model_id &&
          item.enabled &&
          modelHasCredential(item)
      ) || pickTradingModel(models)
  }

  return model
}

/**
 * Resolves a launch-capable exchange. Returns the exchange or a message
 * explaining the most specific missing prerequisite.
 */
export async function resolveLaunchExchange(): Promise<
  { exchange: Exchange } | { exchange: null; reason: string }
> {
  const exchanges = await api.getExchangeConfigs()
  const ready = pickTradingExchange(exchanges)
  if (ready) return { exchange: ready }

  const hyperliquid = exchanges.find(isHyperliquidExchange)
  if (!hyperliquid) {
    return {
      exchange: null,
      reason:
        '尚未连接 Hyperliquid 账户。请先连接 Hyperliquid 并授权 NOFX agent。',
    }
  }
  if (!hyperliquid.enabled) {
    return {
      exchange: null,
      reason: 'Hyperliquid 账户已停用。请先启用。',
    }
  }
  if (!exchangeHasKey(hyperliquid)) {
    return {
      exchange: null,
      reason:
        'Hyperliquid agent 密钥缺失。请重新连接 Hyperliquid 并保存 agent 钱包。',
    }
  }
  if (!hyperliquid.hyperliquidBuilderApproved) {
    return {
      exchange: null,
      reason: 'Hyperliquid builder 授权未完成。请先完成钱包授权。',
    }
  }
  return {
    exchange: null,
    reason: 'Hyperliquid 钱包地址缺失。请重新连接 Hyperliquid。',
  }
}
