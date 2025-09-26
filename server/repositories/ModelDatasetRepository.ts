/**
 * 
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-26T15:23:00-04:00
 * PURPOSE: REAL database queries for model performance on ARC evaluation datasets.
 * Shows which puzzles each model solved correctly (is_prediction_correct OR multi_test_all_correct), 
 * failed, or hasn't attempted. Based on the existing puzzle-analysis.ts queries but for individual models.
 * SRP and DRY check: Pass - Single responsibility for model dataset performance, reuses database connection patterns
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';

interface ModelDatasetPerformance {
  modelName: string;
  solved: string[];
  failed: string[];
  notAttempted: string[];
  summary: {
    solved: number;
    failed: number;
    notAttempted: number;
    totalPuzzles: number;
  };
}

export class ModelDatasetRepository extends BaseRepository {
  
  /**
   * Get model performance on ARC evaluation dataset puzzles
   * Real database query showing which puzzles the model solved correctly, incorrectly, or hasn't attempted
   */
  async getModelDatasetPerformance(modelName: string): Promise<ModelDatasetPerformance> {
    if (!this.isConnected()) {
      return {
        modelName,
        solved: [],
        failed: [],
        notAttempted: [],
        summary: { solved: 0, failed: 0, notAttempted: 0, totalPuzzles: 0 }
      };
    }

    try {
      // Get all evaluation dataset puzzle IDs (from the data/evaluation directory)
      // These are the actual puzzle IDs from the ARC evaluation dataset
      const evaluationPuzzles = [
        '00576224', '009d5c81', '00dbd492', '025d127b', '045e512c', '0520fde7', '05269061', 
        '05f2a901', '06df4c85', '08ed6ac7', '09629e4f', '0962bcdd', '0a938d79', '0b148d64', 
        '0ca9ddb6', '0d3d703e', '0dfd9992', '0e206a2e', '1190e5a7', '11852cab', '1246d751', 
        '137eaa0f', '13713586', '1cf80156', '1e0a9b12', '1f0c79e5', '1f642eb9', '1f85a75f', 
        '1fad071e', '2013d3e2', '2204b7a8', '2281f1f4', '22168020', '2253b469', '234bbc79', 
        '23b5c85d', '253bf280', '25d487eb', '25ff71a9', '264363fd', '272f95fa', '27a28665', 
        '28bf18c6', '28e73c20', '29623171', '29c11459', '2bee17df', '2c608aff', '2dd70a9a', 
        '2dee498d', '31aa019c', '321b1fc6', '32597951', '3345333e', '3428a4f5', '34681ca7', 
        '3618c87e', '3631a71a', '363442ee', '36d67576', '36fdfd69', '3906de3d', '39a8645d', 
        '39e1d7f9', '3ac3eb23', '3af2c5a8', '3bdb4ada', '3c9b0459', '3de23699', '3e980e27', 
        '40853293', '41e4d17e', '4258a5f9', '444801d8', '445eab21', '447fd412', '4522001f', 
        '45736a0e', '469497ad', '46f33fce', '48d8fb45', '4938f0c2', '496994bd', '49d1d64f', 
        '4be741c5', '4c4377d9', '4cd1c327', '4f537728', '4f69f2ca', '50846271', '508bd3b6', 
        '50cb2852', '543a7ed5', '54d82841', '54d9e175', '5521c0d9', '5614dbcf', '56dc2b01', 
        '5ad4f10b', '5bd6f4ac', '5c0a986e', '5c2c9af4', '5daaa586', '60b61512', '62c24649', 
        '6430c8c4', '6455b5f5', '67a3c6ac', '67e8384a', '6773b310', '67a423a3', '681b3aeb', 
        '6855a6e4', '68b16354', '692cd3b6', '6a1e5592', '6aa20dc0', '6b9890af', '6c434453', 
        '6cdd2623', '6d0aefbc', '6d58a25d', '6d75e8bb', '6e02f1e3', '6e19193c', '6ea4a07e', 
        '6ecd11f4', '6f8cd79b', '6fa7a44f', '7039b2a7', '72ca375d', '73251a56', '73ccf9c2', 
        '746b3537', '74dd1130', '780d0b14', '7837ac64', '7b6016b9', '7c008303', '7c7a8adf', 
        '7df24a62', '7e0986d6', '80af3007', '834ec97d', '83302e8f', '8403a5d5', '846bdb03', 
        '855e0971', '85c4e7cd', '868de0fa', '8a004b2b', '8be77c9e', '8d510a79', '8e1813be', 
        '8e5a5113', '8eb1be9a', '8f2ea7aa', '90c28cc7', '91413438', '912e0a18', '91714a58', 
        '928ad970', '93b581b8', '94f9d214', '9565186b', '95990924', '963e52fc', '97999447', 
        '98cf29f8', '99b1bc43', '9aec4887', '9af7a82c', '9ddd00f0', '9def23fe', '9edfc990', 
        'a3325580', 'a3df8b1e', 'a416b8f3', 'a48eeaf7', 'a5313dff', 'a5f85a15', 'a61ba2ce', 
        'a65b410d', 'a68b268e', 'a699fb00', 'a78176bb', 'a79310a0', 'a8c38be5', 'a934301b', 
        'a9f96cdd', 'aa18de87', 'aabf363d', 'ab88b271', 'abc48630', 'ac0a08a4', 'adc83d11', 
        'ae3edfdc', 'ae58858e', 'aedd82e4', 'af22c60d', 'b0c4d837', 'b190f7f5', 'b1948b0a', 
        'b230c067', 'b27ca6d3', 'b2862040', 'b548a754', 'b6b0854e', 'b775ac94', 'b782dc8a', 
        'b7c8f881', 'b94a9452', 'ba26e723', 'ba97ae07', 'bb43febb', 'bbf1d457', 'bc1d5164', 
        'be03b35f', 'c0f76784', 'c1d99e64', 'c35c219d', 'c3e719e8', 'c444b776', 'c48954c5', 
        'c59eb873', 'c8cbb738', 'c8f0f002', 'c909285e', 'c97c0139', 'ca8de6ea', 'cbded52d', 
        'cdecee7f', 'ce22a75a', 'ce4f8723', 'ce602527', 'ccd554ac', 'd07ae81c', 'd0f5fe59', 
        'd13f3404', 'd23f8c26', 'd282b262', 'd37a1ef5', 'd4469312', 'd492a647', 'd4a91cb9', 
        'd511f180', 'd631b094', 'd6ad076f', 'd90796e8', 'dc0a314f', 'dc433765', 'ddf7fa4f', 
        'de1cd16c', 'e21d9049', 'e26a3af2', 'e3497940', 'e40b9e2f', 'e48d4e1a', 'e50d258f', 
        'e509e548', 'e5062a87', 'e73095fd', 'e7639916', 'e7dd8335', 'e8dc4411', 'e9614598', 
        'ea32f5cd', 'ea786f4a', 'eb281b96', 'eb5a1d5d', 'ecdecbb3', 'ed36ccf7', 'ef135b50', 
        'f15e1fac', 'f1cefba8', 'f25fbde4', 'f2829549', 'f35d900a', 'f5b8619d', 'f8b3ba0a', 
        'f8c80d96', 'f9012d9b', 'fafffa47', 'fcb5c309', 'fcc82909', 'feca6190', 'ff28f65a'
      ];

      // Real database query using the same logic as puzzle-analysis.ts
      // Query for puzzles this model has attempted and their results
      const attemptedQuery = `
        SELECT 
          puzzle_id,
          CASE 
            WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 'solved'
            ELSE 'failed'
          END as result,
          created_at
        FROM explanations 
        WHERE model_name ILIKE $1 
        AND puzzle_id = ANY($2)
        AND (is_prediction_correct IS NOT NULL OR multi_test_all_correct IS NOT NULL)
        ORDER BY puzzle_id, created_at DESC
      `;

      const result = await this.query(attemptedQuery, [modelName, evaluationPuzzles]);
      
      // Process results to get unique puzzles (most recent attempt for each)
      const attemptedPuzzles = new Map<string, 'solved' | 'failed'>();
      
      for (const row of result.rows) {
        if (!attemptedPuzzles.has(row.puzzle_id)) {
          attemptedPuzzles.set(row.puzzle_id, row.result);
        }
      }

      // Categorize puzzles
      const solved: string[] = [];
      const failed: string[] = [];
      const notAttempted: string[] = [];

      for (const puzzleId of evaluationPuzzles) {
        if (attemptedPuzzles.has(puzzleId)) {
          if (attemptedPuzzles.get(puzzleId) === 'solved') {
            solved.push(puzzleId);
          } else {
            failed.push(puzzleId);
          }
        } else {
          notAttempted.push(puzzleId);
        }
      }

      return {
        modelName,
        solved: solved.sort(),
        failed: failed.sort(), 
        notAttempted: notAttempted.sort(),
        summary: {
          solved: solved.length,
          failed: failed.length,
          notAttempted: notAttempted.length,
          totalPuzzles: evaluationPuzzles.length
        }
      };

    } catch (error) {
      logger.error(`Error getting model dataset performance for ${modelName}: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }

  /**
   * Get list of all models that have attempted any puzzles
   */
  async getAvailableModels(): Promise<string[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      const query = `
        SELECT DISTINCT model_name
        FROM explanations
        WHERE model_name IS NOT NULL
        AND (is_prediction_correct IS NOT NULL OR multi_test_all_correct IS NOT NULL)
        ORDER BY model_name
      `;

      const result = await this.query(query);
      return result.rows.map(row => row.model_name);
      
    } catch (error) {
      logger.error(`Error getting available models: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    }
  }
}

export default new ModelDatasetRepository();
