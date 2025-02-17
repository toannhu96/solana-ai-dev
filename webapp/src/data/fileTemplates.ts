import { snakeToPascal, normalizeName, extractInstructionContext } from '../utils/genCodeUtils';
import { Instruction, Account } from '../types/uiTypes';
export const getLibRsTemplate = (
  programName: string,
  programId: string,
  instructionDetails: { instruction_name: string; context: string; params: string }[]
): string => {
  // Generate imports for each instruction
  const instructionImports = instructionDetails
    .map(({ instruction_name, context, params }) => {
      const moduleName = instruction_name; // Module name is the instruction name
      const imports = [context, params].filter(Boolean).join(", ");
      return `use instructions::${moduleName}::{${imports}};`;
    })
    .join('\n');

  // Generate program implementation
  const programFunctions = instructionDetails
    .map(({ instruction_name, context, params }) => {
      const moduleName = instruction_name;
      const functionName = instruction_name; // The function name in lib.rs matches the module name
      const contextStruct = context;
      const paramsStruct = params;
      return `
        pub fn ${functionName}(ctx: Context<${contextStruct}>, params: ${paramsStruct}) -> Result<()> {
            instructions::${moduleName}::${functionName}(ctx, params)
        }`;
    })
    .join('\n');

  return `
  use anchor_lang::prelude::*;

  pub mod instructions;
  pub mod state;
  use instructions::*;

  declare_id!("${programId}");

  #[program]
  pub mod ${programName} {
      use super::*;
      
      ${programFunctions}
  }
  `;
};

export const getModRsTemplate = (instructions: string[], additionalContext?: string): string => {
  const imports = instructions.map((name) => `pub mod ${name};`).join('\n');
  const exports = instructions.map((name) => `pub use ${name}::*;`).join('\n');

  return [
    additionalContext ? `// ${additionalContext}` : '',
    exports,
    '',
    imports
  ].filter(Boolean).join('\n');
};

export const getStateTemplate = (
  accountStructs: {
    name: string;
    description?: string;
    data_structure: {
      fields: { field_name: string; field_type: string; attributes?: string[] }[];
    };
  }[]
): string => {
  //console.log("accountStructs", accountStructs);

  // Deduplicate accounts by `name`
  const uniqueAccounts = Array.from(
    new Map(accountStructs.map(account => [account.name, account])).values()
  );

  const accounts = uniqueAccounts
    .map(({ name, description, data_structure }) => {
      const fieldsStr = data_structure.fields
        .map(({ field_name, field_type, attributes }) => {
          const attributeStr = attributes?.length
            ? attributes.map(attr => `    #[${attr}]`).join('\n') + '\n'
            : '';
          return `${attributeStr}    pub ${field_name}: ${field_type},`;
        })
        .join('\n');

      const descriptionStr = description
        ? `#[doc = "${description}"]\n`
        : '';

      return `
${descriptionStr}#[account]
pub struct ${name} {
${fieldsStr}
}
`;
    })
    .join('\n');

  return `
use anchor_lang::prelude::*;

${accounts}
`;
};

export const getInstructionTemplate = (
  instructionName: string,
  functionName: string,
  functionLogic: string,
  contextStruct: string,
  paramsStruct: string,
  accounts: { name: string; type: string; attributes: string[] }[],
  paramsFields: { name: string; type: string }[],
  errorCodes: { name: string; msg: string }[]
): string => {
  const pascalName = snakeToPascal(instructionName);
  const errorEnumName = pascalName.startsWith("Run") ? pascalName.slice(3) + "ErrorCode" : pascalName + "ErrorCode";

  const accountsStruct = accounts.map(
      ({ name, type, attributes }) =>
        `    #[account(${attributes.join(", ")})]\n    pub ${name}: ${type},`
    ).join('\n\n');

  const paramsStructFields = paramsFields.map(({ name, type }) => `    pub ${name}: ${type},`).join('\n');

  return `
  use anchor_lang::prelude::*;
  use crate::state::*;

  pub fn ${functionName}(ctx: Context<${contextStruct}>, params: ${paramsStruct}) -> Result<()> {
      ${functionLogic}
  }

  #[derive(Accounts)]
  pub struct ${contextStruct}<'info> {
  ${accountsStruct}
  }

  #[derive(AnchorSerialize, AnchorDeserialize)]
  pub struct ${paramsStruct} {
  ${paramsStructFields}
  }

  #[error_code]
  pub enum ${errorEnumName} {
  ${errorCodes.map(({ name, msg }) => `    #[msg("${msg}")] ${name},`).join('\n')}
  }
  `;
};

export const getTestTemplate = (
  programName: string,
  programId: string,
  instructions: { name: string; description: string; params: string[] }[],
  accounts: { name: string; description: string; fields: { name: string; type: string }[] }[]
): string => {
  // Generate test cases for each instruction
  const instructionTests = instructions
    .map(({ name, description, params }) => {
      const paramsList = params.map((param) => `${param}: any`).join(", ");
      return `
  it("should execute ${name} instruction", async () => {
    // Arrange: Set up accounts and parameters
    const params = { ${params.map((param) => `${param}: "example_value"`).join(", ")} };
    const accounts = {
      // Add required account public keys here
    };

    // Act: Call the instruction
    const tx = await program.methods.${name}(${params.map((param) => `params.${param}`).join(", ")})
      .accounts(accounts)
      .rpc();

    // Assert: Verify the expected outcome
    console.log("Transaction signature", tx);
    // TODO: Add assertions to validate the program state
  });`;
    })
    .join("\n");

  // Generate helper functions for account initialization
  const accountHelpers = accounts
    .map(({ name, fields }) => {
      return `
  /**
   * Helper function to create and initialize a ${name} account.
   */
  const create${name}Account = async () => {
    const newAccount = web3.Keypair.generate();
    await program.methods.initialize${name.toLowerCase()}()
      .accounts({
        ${fields.map(({ name }) => `${name}: newAccount.publicKey`).join(",\n        ")}
      })
      .signers([newAccount])
      .rpc();
    return newAccount;
  };`;
    })
    .join("\n");

  return `
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { ${programName} } from '../target/types/${programName}';

describe("${programName} Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.${programName} as Program<${programName}>;

  ${accountHelpers}

  ${instructionTests}
});
`;
};





  
