/**
 * Author: gpt-5-codex
 * Date: 2025-12-03
 * PURPOSE: Centralizes multi-prediction detection so services know when to run
 * multi-test validation even if providers omit sentinel booleans.
 * SRP/DRY check: Pass – utility functions only.
 */

const NUMBERED_PREDICTION_REGEX = /^predictedOutput\d+$/i;

const hasNumberedPredictionFields = (payload: any): boolean => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  return Object.keys(payload).some(key => NUMBERED_PREDICTION_REGEX.test(key));
};

export const getDeclaredMultiPredictionField = (payload: any): any => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.multiplePredictedOutputs !== undefined) {
    return payload.multiplePredictedOutputs;
  }

  if (payload.result && typeof payload.result === 'object' && payload.result.multiplePredictedOutputs !== undefined) {
    return payload.result.multiplePredictedOutputs;
  }

  return null;
};

export const shouldValidateAsMultiTest = (payload: any, expectedTestCount: number): boolean => {
  const declaredValue = getDeclaredMultiPredictionField(payload);
  const hasExplicitFlag = declaredValue === true;
  const hasArrayPayload = Array.isArray(declaredValue) && declaredValue.length > 0;
  const hasNumberedFields =
    hasNumberedPredictionFields(payload) || hasNumberedPredictionFields(payload?.result);
  const isMultiPuzzle = expectedTestCount > 1;

  return Boolean(isMultiPuzzle || hasExplicitFlag || hasArrayPayload || hasNumberedFields);
};
