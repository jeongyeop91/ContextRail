export function evaluateThroughlineReadiness({ binaryPresent, prepared = false, version = null, diagnostics = null, captureEvidence = null }) {
  const reasons = [];
  if (!binaryPresent) return { state: prepared ? 'prepared' : 'absent', reasons: [prepared ? 'artifact_prepared' : 'binary_absent'] };
  if (!version) return { state: 'incompatible', reasons: ['version_unavailable'] };
  if (!diagnostics) return { state: 'installed', version, reasons: ['diagnostics_unavailable'] };
  if (diagnostics.schema !== 'throughline.native_factory_diagnostics.v1') {
    return { state: 'incompatible', version, reasons: ['diagnostics_schema_incompatible'] };
  }

  const captureVerified =
    Number.isFinite(captureEvidence?.capturedRows) && captureEvidence.capturedRows > 0 &&
    Number.isFinite(captureEvidence?.capturedDetails) && captureEvidence.capturedDetails > 0 &&
    captureEvidence.injectedContextExcluded === true;
  if (captureEvidence && !captureVerified) reasons.push('capture_evidence_incomplete');

  if (diagnostics.overall?.status !== 'ready' || diagnostics.hooks?.status !== 'ready') {
    reasons.push(diagnostics.hooks?.status !== 'ready' ? 'hooks_not_ready' : 'factory_not_ready');
    return { state: 'degraded', version, diagnostics, reasons };
  }
  if (captureVerified) return { state: 'capture_verified', version, diagnostics, captureEvidence, reasons };
  return { state: 'hooks_ready', version, diagnostics, reasons };
}

export async function verifyThroughline({ binary = 'throughline', processAdapter, env, prepared = false, captureEvidence = null }) {
  let versionResult;
  try {
    versionResult = await processAdapter.run(binary, ['--version'], { env, timeoutMs: 10000 });
  } catch (error) {
    return { ...evaluateThroughlineReadiness({ binaryPresent: false, prepared }), error: error.code ?? 'binary_unavailable' };
  }
  if (versionResult.code !== 0) return evaluateThroughlineReadiness({ binaryPresent: true, prepared, version: null });
  const version = versionResult.stdout.trim();
  const diagnosticsResult = await processAdapter.run(binary, ['factory-diagnostics', '--json'], { env, timeoutMs: 20000 });
  if (diagnosticsResult.code !== 0) return { state: 'degraded', version, reasons: ['factory_diagnostics_failed'] };
  let diagnostics;
  try {
    diagnostics = JSON.parse(diagnosticsResult.stdout);
  } catch {
    return { state: 'incompatible', version, reasons: ['diagnostics_json_invalid'] };
  }
  return evaluateThroughlineReadiness({ binaryPresent: true, prepared, version, diagnostics, captureEvidence });
}
