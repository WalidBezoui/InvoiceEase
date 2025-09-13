
'use server';
/**
 * @fileOverview An AI agent for analyzing product transaction data.
 *
 * - analyzeProductTransactions - A function that analyzes sales and stock data.
 */

import { ai } from '@/ai/genkit';
import { ProductAnalysisInputSchema, ProductAnalysisOutputSchema, type ProductAnalysisInput, type ProductAnalysisOutput } from '@/lib/types';


export async function analyzeProductTransactions(input: ProductAnalysisInput): Promise<ProductAnalysisOutput> {
  return productAnalysisFlow(input);
}

const productAnalysisPrompt = ai.definePrompt({
  name: 'productAnalysisPrompt',
  input: { schema: ProductAnalysisInputSchema },
  output: { schema: ProductAnalysisOutputSchema },
  prompt: `
    You are an expert business analyst specializing in inventory management and sales strategy for small businesses.
    Your task is to analyze the provided data for a single product and give the user a clear, concise analysis and actionable suggestions.

    Analyze the following product data (All prices are in {{{currency}}}):
    - Product Name: {{{productName}}}
    - Current Stock: {{{currentStock}}}
    - Standard Selling Price: {{{sellingPrice}}}
    - Standard Purchase Price: {{{purchasePrice}}}

    Transaction History (most recent first):
    {{#each transactions}}
    - Type: {{type}}, Quantity: {{quantityChange}}, Price: {{#if transactionPrice}}{{transactionPrice}}{{else}}N/A{{/if}}, Date: {{transactionDate}}
    {{/each}}

    Based on this data, perform the following:

    1.  **Analysis**: Write a short paragraph (3-4 sentences) summarizing the product's performance.
        - Calculate and comment on the sales velocity (how quickly the product sells).
        - Analyze stock trends. Is it decreasing rapidly? Is it stagnant?
        - If purchase and selling prices are available, comment on the product's profitability. Mention if recent sales prices differ from the standard selling price.

    2.  **Suggestions**: Provide a list of 2 to 4 clear, actionable suggestions.
        - If stock is low and sales are consistent, suggest reordering. Estimate when they might run out.
        - If the product is selling very well, suggest a potential price increase or promotion.
        - If sales are slow or stagnant, suggest a marketing push or a discount.
        - If purchase prices have been increasing, suggest reviewing the selling price to maintain margins.
        - Keep the suggestions practical and directly related to the provided data.

    Present your response in the specified JSON format. The language should be clear, professional, and encouraging.
  `,
});

const productAnalysisFlow = ai.defineFlow(
  {
    name: 'productAnalysisFlow',
    inputSchema: ProductAnalysisInputSchema,
    outputSchema: ProductAnalysisOutputSchema,
  },
  async (input) => {
    const { output } = await productAnalysisPrompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid analysis.");
    }
    return output;
  }
);
