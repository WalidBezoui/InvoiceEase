
'use server';
/**
 * @fileOverview An AI agent for analyzing product transaction data and providing tips.
 *
 * - analyzeProductTransactions - A function that analyzes sales and stock data.
 * - getProductTip - A function that provides a short, actionable tip for a product.
 */

import { ai } from '@/ai/genkit';
import { ProductAnalysisInputSchema, ProductAnalysisOutputSchema, ProductTipInputSchema, ProductTipOutputSchema, type ProductAnalysisInput, type ProductAnalysisOutput, type ProductTipInput, type ProductTipOutput } from '@/lib/types';


export async function analyzeProductTransactions(input: ProductAnalysisInput): Promise<ProductAnalysisOutput> {
  return productAnalysisFlow(input);
}

export async function getProductTip(input: ProductTipInput): Promise<ProductTipOutput> {
    return productTipFlow(input);
}

const productAnalysisPrompt = ai.definePrompt({
  name: 'productAnalysisPrompt',
  input: { schema: ProductAnalysisInputSchema },
  output: { schema: ProductAnalysisOutputSchema },
  prompt: `
    You are an expert business analyst specializing in inventory management and sales strategy for small businesses.
    Your task is to analyze the provided data for a single product and give the user a clear, concise analysis and actionable suggestions in the requested language: {{language}}.

    Analyze the following product data (All prices are in {{{currency}}}):
    - Product Name: {{{productName}}}
    - Current Stock: {{{currentStock}}}
    - Standard Selling Price: {{{sellingPrice}}}
    - Standard Purchase Price: {{{purchasePrice}}}

    Transaction History (most recent first):
    {{#each transactions}}
    - Type: {{type}}, Quantity: {{quantityChange}}, Price: {{#if transactionPrice}}{{transactionPrice}}{{else}}N/A{{/if}}, Date: {{transactionDate}}
    {{/each}}

    Based on this data, perform the following in {{language}}:

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

    Present your response in the specified JSON format. The language must be {{language}}.
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


// Flow for the short product tip
const productTipPrompt = ai.definePrompt({
    name: 'productTipPrompt',
    input: { schema: ProductTipInputSchema },
    output: { schema: ProductTipOutputSchema },
    prompt: `
        You are an inventory management assistant. Based on the product data, provide a very short, actionable tip (3-5 words max) in the specified language: {{language}}.
        
        Data:
        - Stock Level: {{stockLevel}}
        - Number of sales in last 30 days: {{salesLast30Days}}

        Analyze the data and choose ONE of the following tip types: 'suggestion', 'warning', or 'info'.
        
        - Use 'warning' for critical issues like "Stock is very low" or "No recent sales".
        - Use 'suggestion' for opportunities like "Selling fast" or "Consider promotion".
        - Use 'info' for neutral statements like "Steady sales".

        Your tip must be concise and fit in a small table cell.

        Example responses in English:
        - { "tip": "Stock is low", "type": "warning" }
        - { "tip": "Selling fast", "type": "suggestion" }
        - { "tip": "Slow-moving", "type": "warning" }
        - { "tip": "Steady sales", "type": "info" }

        Example responses in French:
        - { "tip": "Stock faible", "type": "warning" }
        - { "tip": "Vente rapide", "type": "suggestion" }
        - { "tip": "Peu de ventes", "type": "warning" }
        - { "tip": "Ventes stables", "type": "info" }
        
        Now, analyze the provided data and generate the response.
    `,
});

const productTipFlow = ai.defineFlow(
    {
        name: 'productTipFlow',
        inputSchema: ProductTipInputSchema,
        outputSchema: ProductTipOutputSchema,
    },
    async (input) => {
        const { output } = await productTipPrompt(input);
        if (!output) {
            throw new Error("The AI model did not return a valid tip.");
        }
        return output;
    }
);
