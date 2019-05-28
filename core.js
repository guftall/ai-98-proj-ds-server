const Fs = require('fs');
const Sox = require('sox-stream');
const DeepSpeech = require('deepspeech');
const argparse = require('argparse');
const MemoryStream = require('memory-stream');
const Wav = require('node-wav');
const Duplex = require('stream').Duplex;
const util = require('util');

// These constants control the beam search decoder

const MODEL_PATH = "../models/output_graph.pbmm";
const ALPHABET_PATH = "../models/alphabet.txt";
const LM_PATH = "../models/lm.binary";
const TRIE_PATH = "../models/trie";

// Beam width used in the CTC decoder when building candidate transcriptions
const BEAM_WIDTH = 500;

// The alpha hyperparameter of the CTC decoder. Language Model weight
const LM_ALPHA = 0.75;

// The beta hyperparameter of the CTC decoder. Word insertion bonus.
const LM_BETA = 1.85;

var model = undefined;

// These constants are tied to the shape of the graph used (changing them changes
// the geometry of the first layer), so make sure you use the same constants that
// were used during training

// Number of MFCC features to use
const N_FEATURES = 26;

// Size of the context window used for producing timesteps in the input vector
const N_CONTEXT = 9;


function totalTime(hrtimeValue) {
  return (hrtimeValue[0] + hrtimeValue[1] / 1000000000).toPrecision(4);
}

exports.bufferReceived = function bufferReceived(buffer, cb) {

    var result;
    try {
        result = Wav.decode(buffer);
    } catch (er) {
        return;
    }
    if (result == undefined) {
        return;
    }
    if (result.sampleRate < 16000) {
        console.error('Warning: original sample rate (' + result.sampleRate + ') is lower than 16kHz. Up-sampling might produce erratic speech recognition.');
    }

    var audioStream = new MemoryStream();
    bufferToStream(buffer).
        pipe(Sox({
            global: {
            'no-dither': true,
            },
            output: {
            bits: 16,
            rate: 16000,
            channels: 1,
            encoding: 'signed-integer',
            endian: 'little',
            compression: 0.0,
            type: 'raw'
            }
        })).
        pipe(audioStream);
    audioStream.on('finish', () => {
        let audioBuffer = audioStream.toBuffer();
        
    
        const inference_start = process.hrtime();
        console.error('Running inference.');
        const audioLength = (audioBuffer.length / 2) * ( 1 / 16000);
        
        // We take half of the buffer_size because buffer is a char* while
        // LocalDsSTT() expected a short*
        var resultString = model.stt(audioBuffer.slice(0, audioBuffer.length / 2), 16000);
        console.log(resultString);
        cb(resultString);
        
        const inference_stop = process.hrtime(inference_start);
        console.error('Inference took %ds for %ds audio file.', totalTime(inference_stop), audioLength.toPrecision(4));
        // Ds.DestroyModel(model);
        // process.exit(0);
    });
}

exports.loadModel = function loadModel() {

    console.error('Loading model from file %s', MODEL_PATH);
    const model_load_start = process.hrtime();
    model = new DeepSpeech.Model(MODEL_PATH, N_FEATURES, N_CONTEXT, ALPHABET_PATH, BEAM_WIDTH);
    const model_load_end = process.hrtime(model_load_start);
    console.error('Loaded model in %ds.', totalTime(model_load_end));


    console.error('Loading language model from files %s %s', LM_PATH, TRIE_PATH);
    const lm_load_start = process.hrtime();
    model.enableDecoderWithLM(ALPHABET_PATH, LM_PATH, TRIE_PATH,
                            LM_ALPHA, LM_BETA);
    const lm_load_end = process.hrtime(lm_load_start);
    console.error('Loaded language model in %ds.', totalTime(lm_load_end));
}


function bufferToStream(buffer) {
  var stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
}