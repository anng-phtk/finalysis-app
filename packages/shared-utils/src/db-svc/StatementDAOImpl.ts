import { Collection, Db, Filter, Sort, UpdateResult } from "mongodb";
import { StatementDao, StatementDoc } from "./statement.types.js";
import { Log, LoggingService } from "../logging/logging.types.js";
import { DatabaseError } from "../error-handlers/app-errors.js";



export class StatementDaoImpl implements StatementDao {
    private collection: Collection<StatementDoc>;
    private log: Log;
    private readonly COLLECTION_NAME = 'statements'; // Define collection name centrally

    // DAO constructor gets Db object and logger INSTANCE injected
    constructor(db: Db, logger: LoggingService) {
        this.collection = db.collection<StatementDoc>(this.COLLECTION_NAME);
        this.log = logger.getLogger('stmt-dao'); // Use the passed-in logger instance
        this.log.info(`StatementDao initialized for collection: ${this.COLLECTION_NAME}`);
        // Ensure indexes exist (call asynchronously, don't block constructor)
        this.ensureIndexes().catch(err => {
            this.log.error("Error ensuring indexes during initialization.", err);
        });
    }

    /**
     * Creates necessary indexes if they don't already exist.
     * Should be called once during application startup or DAO initialization.
     */
    private async ensureIndexes(): Promise<void> {
        this.log.debug("Ensuring indexes exist for 'statements' collection...");
        try {
            // Unique index to prevent duplicate statements for the same source file in a filing
            await this.collection.createIndex(
                { cik: 1, accessionNumber: 1, formType: 1, sourceFile: 1 },
                { unique: true, name: "filing_statement_source_unique_idx" }
            );
            // Index for finding statements by ticker and type, sorted by date
            await this.collection.createIndex(
                { ticker: 1, statementType: 1, filingDate: -1 },
                { name: "ticker_stmtType_filingDate_idx" }
            );
            // Index for finding all statements for a specific filing
            await this.collection.createIndex(
                { cik: 1, accessionNumber: 1, formType: 1 },
                { name: "filing_lookup_idx" }
            );
            this.log.info("Successfully ensured indexes for 'statements' collection.");
        } catch (indexError: any) {
            // Log index creation errors but don't necessarily crash the app
            // MongoDB handles duplicate index creation gracefully (noop)
            if (indexError.codeName === 'IndexOptionsConflict' || indexError.codeName === 'IndexKeySpecsConflict') {
                this.log.warn(`Index conflict detected for 'statements' collection (likely already exists): ${indexError.message}`);
            } else {
                this.log.error("Error creating indexes for 'statements' collection.", indexError);
                // Depending on error, you might want to throw or handle differently
            }
        }
    }

    /**
     * Implements upsertStatement from IStatementDao.
     */
    async upsertStatement(statementDoc: StatementDoc): Promise<boolean> {
        // Define filter based on unique identifier fields
        const filter = {
            cik: statementDoc.cik,
            accessionNumber: statementDoc.accessionNumber,
            formType: statementDoc.formType,
            sourceFile: statementDoc.sourceFile // Include sourceFile for uniqueness
        };

        // Ensure processedAt is set
        const docToUpsert = {
            ...statementDoc,
            processedAt: new Date() // Update timestamp on every upsert
        };

        this.log.debug(`Upserting statement`, { filter });
        try {
            const result: UpdateResult = await this.collection.updateOne(
                filter,
                { $set: docToUpsert }, // Use $set to update all fields if found, or insert if not
                { upsert: true }       // Create document if it doesn't exist
            );
            this.log.info(`Upsert result for statement ${filter.sourceFile}: matched=${result.matchedCount}, modified=${result.modifiedCount}, upsertedId=${result.upsertedId}`);
            // Return true if a document was inserted OR an existing one was matched/modified
            return result.modifiedCount > 0 || result.matchedCount > 0 || !!result.upsertedId;
        } catch (error: any) {
            this.log.error(`Error upserting statement`);
            // Throw a specific DB error, wrapping the original
            throw new DatabaseError(`Database upsert failed for statement ${filter.sourceFile}`, error);
        }
    }

    /**
     * Implements findStatementsByFiling from IStatementDao.
     */
    async findStatementsByFiling(cik: string, accessionNumber: string, formType: string): Promise<StatementDoc[]> {
        const filter = { cik, accessionNumber, formType };
        this.log.debug(`Finding statements by filing`, { filter });

        try {
            const documents = await this.collection.find(filter).toArray();
            this.log.info(`Found ${documents.length} statements for filing`, { filter });
            return documents;
        } catch (error: any) {
            this.log.error(`Error finding statements by filing ${filter}, ${error}`);
            throw new DatabaseError(`Database find failed for filing ${accessionNumber}`, error);
        }
    }

    /**
     * Implements findStatementsByTicker from IStatementDao.
     */
    public async findStatementsByTicker(
        ticker: string,
        statementType?: string,
        formType?: string,
        limit: number = 0, // Default limit
        sortOrder: 1 | -1 = -1 // Default sort descending (most recent first)
    ): Promise<StatementDoc[]> {
        const filter: Filter<StatementDoc> = { ticker };
        if (statementType) {
            filter.statementType = statementType;
        }

        if (formType) {
            filter.formType = formType; // either 10-K or 10-Q
            //filter.accessionNumber = '000104581017000027';
        }
        const sort: Sort = { filingDate: sortOrder };

        this.log.debug(`Finding statements by ticker`, { filter, limit, sort });

        try {
            let cursor = this.collection.find(filter).sort(sort);

            if (limit > 0) {
                cursor = cursor.limit(limit);
            }
            // If limit is 0 or less, we don't apply .limit(), so it fetches all matching.

            const documents = await cursor.toArray();
            
            this.log.info(`Found ${documents.length} statements for ticker ${ticker}`, { 
                filter, 
                limitApplied: limit > 0 ? limit : 'NONE (all matching)', 
                count: documents.length 
            });
        
            return documents;
        } catch (error: any) {
            this.log.error(`Error finding statements by ticker ${ticker}, ${filter}, ${error}`);
            throw new DatabaseError(`Database find failed for ticker ${ticker}`, error);
        }
    }
}


export function createStatementDao(db: Db, loggingSvc: LoggingService): StatementDao {
    // no caching needed
    return new StatementDaoImpl(db, loggingSvc);
}