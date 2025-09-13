
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
        You are an expert inventory management assistant. Your goal is to provide a very short, actionable tip (max 4 words) in the specified language: {{language}}.
        This tip will be displayed in a table cell to give the user a quick health check of the product.

        Here is the data you will analyze:
        - Stock Level: {{stockLevel}}
        - Number of sales in last 30 days: {{salesLast30Days}}

        Use the following rules to generate the tip:
        1.  **Analyze the data**: Correlate the stock level with the sales velocity.
        2.  **Choose a Tip Type**: Select ONE of 'warning', 'suggestion', or 'info'.
            -   **Warning**: Use for critical issues that require immediate attention.
            -   **Suggestion**: Use for opportunities or non-critical actions.
            -   **Info**: Use for neutral or positive status updates.
        3.  **Generate a Concise Tip**: The tip must be very short and impactful.

        Here are your rules and expert examples. Follow them closely.

        **WARNINGS (Type: 'warning')**
        - If stock is 0: "Out of stock"
        - If stock is between 1 and 5: "Critically low stock"
        - If stock is > 5 but sales > stock * 2: "Very high demand"
        - If sales in last 30 days is 0 and stock is > 0: "Stagnant stock"
        
        **SUGGESTIONS (Type: 'suggestion')**
        - If sales > 10 and stock > sales: "Selling well"
        - If sales > 20: "Best-seller potential"
        - If stock is high (e.g., > 50) and sales are low (e.g., < 5): "Consider promotion"

        **INFO (Type: 'info')**
        - If sales are between 1 and 10, and stock > sales: "Steady sales"
        - If stock is high (>50) and sales are also high (>10): "Healthy stock level"

        Example responses in English:
        - { "tip": "Critically low stock", "type": "warning" }
        - { "tip": "Stagnant stock", "type": "warning" }
        - { "tip": "Selling well", "type": "suggestion" }
        - { "tip": "Steady sales", "type": "info" }

        Example responses in French:
        - { "tip": "Stock très faible", "type": "warning" }
        - { "tip": "Stock stagnant", "type": "warning" }
        - { "tip": "Bonne vente", "type": "suggestion" }
        - { "tip": "Ventes stables", "type": "info" }
        
        Now, analyze the provided data and generate the expert response in {{language}}.
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
