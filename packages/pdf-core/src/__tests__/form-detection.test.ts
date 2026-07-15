import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createFormFields, type DetectedField } from '../form-detection.js';

describe('createFormFields', () => {
  it('creates text widgets after their default appearance exists', async () => {
    const source = await PDFDocument.create();
    source.addPage([612, 792]);
    const input = await source.save();
    const field: DetectedField = {
      id: 'customer_name',
      name: 'customer_name',
      label: 'Customer name',
      type: 'text',
      page: 1,
      bounds: { x: 50, y: 700, width: 200, height: 24 },
      confidence: 100,
      required: false,
    };

    const result = await createFormFields({ document: input, fields: [field] });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    const output = await PDFDocument.load(result.data!);
    expect(output.getForm().getTextField('customer_name')).toBeDefined();
  });
});
