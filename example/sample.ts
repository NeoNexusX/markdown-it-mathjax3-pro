/**
 * Markdown shared by both examples. It deliberately includes the constructs
 * that plain Markdown would otherwise mangle -- paired asterisks, an escaped
 * underscore and the LaTeX '\\' line break inside an aligned environment.
 */
export const sampleMarkdown = `
Direction cosines are a common way to describe the orientation of a vector.

Consider a vector $\\overrightarrow{l}$ in the plane, with coordinates $(a,b)$.
Normalising it gives the **direction vector**:

$$
\\left(\\frac{a}{\\sqrt{a^2+b^2}},\\frac{b}{\\sqrt{a^2+b^2}}\\right)
$$

The two marked angles $\\alpha$ and $\\beta$ are complementary, so each
component can be written as a cosine:

$$
\\begin{aligned}
\\frac{a}{\\sqrt{a^2+b^2}} &= \\cos{\\alpha} \\\\
\\frac{b}{\\sqrt{a^2+b^2}} &= \\cos{\\beta}
\\end{aligned}
$$

Independence is written $P(A \\cap B) = P(A)*P(B)$, and an escaped underscore
such as $x \\_ y$ also survives intact.
`;
