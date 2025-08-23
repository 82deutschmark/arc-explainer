/**
 * BatchTesting.tsx
 * 
 * Page component for batch testing functionality.
 * Wraps the BatchTesting component and provides page-level layout.
 * Accessible via /batch route for AI model batch analysis.
 * 
 * @author Cascade
 */

import React from 'react';
import { BatchTesting as BatchTestingComponent } from '../components/batch/BatchTesting';

export default function BatchTesting() {
  return <BatchTestingComponent />;
}
