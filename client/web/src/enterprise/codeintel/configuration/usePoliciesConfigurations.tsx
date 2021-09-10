import { ApolloError, FetchResult, MutationFunctionOptions } from '@apollo/client'

import { gql, useQuery, useMutation } from '@sourcegraph/shared/src/graphql/graphql'

import {
    Exact,
    CodeIntelligenceConfigurationPolicyFields,
    CodeIntelligenceConfigurationPoliciesResult,
    DeleteCodeIntelligenceConfigurationPolicyResult,
    DeleteCodeIntelligenceConfigurationPolicyVariables,
} from '../../../graphql-operations'

import { codeIntelligenceConfigurationPolicyFieldsFragment as defaultCodeIntelligenceConfigurationPolicyFieldsFragment } from './backend'

// Query
interface UsePoliciesConfigResult {
    policies: CodeIntelligenceConfigurationPolicyFields[]
    loadingPolicies: boolean
    policiesError: ApolloError | undefined
}

export const POLICIES_CONFIGURATION = gql`
    query CodeIntelligenceConfigurationPolicies($repositoryId: ID) {
        codeIntelligenceConfigurationPolicies(repository: $repositoryId) {
            ...CodeIntelligenceConfigurationPolicyFields
        }
    }

    ${defaultCodeIntelligenceConfigurationPolicyFieldsFragment}
`

export const usePoliciesConfig = (repositoryId?: string | null): UsePoliciesConfigResult => {
    const { data, error, loading } = useQuery<CodeIntelligenceConfigurationPoliciesResult>(POLICIES_CONFIGURATION, {
        variables: { repositoryId: repositoryId ?? null },
    })

    return {
        policies: data?.codeIntelligenceConfigurationPolicies || [],
        loadingPolicies: loading,
        policiesError: error,
    }
}

// Mutations
export type DeletePolicyResult = Promise<
    | FetchResult<DeleteCodeIntelligenceConfigurationPolicyResult, Record<string, string>, Record<string, string>>
    | undefined
>

export interface UseDeletePoliciesResult {
    handleDeleteConfig: (
        options?:
            | MutationFunctionOptions<
                  DeleteCodeIntelligenceConfigurationPolicyResult,
                  Exact<{
                      id: string
                  }>
              >
            | undefined
    ) => DeletePolicyResult
    isDeleting: boolean
    deleteError: ApolloError | undefined
}

const DELETE_POLICY_BY_ID = gql`
    mutation DeleteCodeIntelligenceConfigurationPolicy($id: ID!) {
        deleteCodeIntelligenceConfigurationPolicy(policy: $id) {
            alwaysNil
        }
    }
`

export const useDeletePolicies = (): UseDeletePoliciesResult => {
    const [handleDeleteConfig, { loading, error }] = useMutation<
        DeleteCodeIntelligenceConfigurationPolicyResult,
        DeleteCodeIntelligenceConfigurationPolicyVariables
    >(DELETE_POLICY_BY_ID)

    return {
        handleDeleteConfig,
        isDeleting: loading,
        deleteError: error,
    }
}
